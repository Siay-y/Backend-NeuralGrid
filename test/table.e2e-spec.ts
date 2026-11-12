import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/core/http/configure-http';
import { configureRealtime } from '../src/core/realtime/configure-realtime';
import { ProvisionUserUseCase } from '../src/modules/users/application/use-cases/provision-user.use-case';
import { MAX_CONNECTIONS_PER_USER } from '../src/modules/tabletop/presentation/ws/table.gateway';

const ALLOWED_ORIGIN = 'http://localhost:4200';
const PASSWORD = 'senha-longa-para-testes-e2e';

interface Snapshot {
  you: { id: string; role: string };
  tokens: Array<{ id: string }>;
  members: Array<Record<string, unknown>>;
  online: string[];
  messages: MessageData[];
  drawings: DrawingData[];
  sheets: SheetData[];
}

interface SheetData {
  id: string;
  ownerId: string | null;
  kind: string;
  data: {
    identity: { name: string };
    status: { hp: { current: number; max: number } };
  };
}

interface DrawingData {
  id: string;
  authorId: string;
  color: string;
  points: number[];
}

interface MessageData {
  id: string;
  text: string | null;
  roll: {
    total: number;
    terms: Array<{ rolls?: Array<{ value: number; kept: boolean }> }>;
  } | null;
}

interface Ack<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface CombatData {
  round: number;
  turnId: string | null;
  combatants: Array<{
    tokenId: string;
    initiative: number | null;
    hidden: boolean;
  }>;
}

interface TokenData {
  id: string;
  col: number;
  row: number;
  version: number;
  ownerId: string | null;
}

let ipCounter = 0;

describe('Table gateway (e2e)', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const sessions: Record<string, { token: string; userId: string }> = {};
  const sockets: Socket[] = [];

  const login = async (username: string) => {
    const { body } = await request(app.getHttpServer() as App)
      .post('/api/auth/login')
      .set('X-Forwarded-For', `198.51.100.${++ipCounter}`)
      .send({ username, password: PASSWORD })
      .expect(200);
    sessions[username] = { token: body.accessToken, userId: body.user.id };
  };

  const open = (
    token: string | undefined,
    origin = ALLOWED_ORIGIN,
  ): Promise<{ socket: Socket; snapshot: Snapshot }> =>
    new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/table`, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        extraHeaders: { Origin: origin },
        reconnection: false,
        forceNew: true,
        autoConnect: false,
      });
      sockets.push(socket);
      socket.once('table:snapshot', (snapshot: Snapshot) =>
        resolve({ socket, snapshot }),
      );
      socket.once('connect_error', reject);
      socket.connect();
    });

  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

  const until = <T>(
    socket: Socket,
    event: string,
    matches: (payload: T) => boolean,
  ) =>
    new Promise<T>((resolve) => {
      const listener = (payload: T) => {
        if (matches(payload)) {
          socket.off(event, listener);
          resolve(payload);
        }
      };
      socket.on(event, listener);
    });

  const send = <T>(socket: Socket, event: string, payload: unknown) =>
    socket.timeout(5000).emitWithAck(event, payload) as Promise<Ack<T>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttp(app);
    configureRealtime(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    await app.get(DataSource).query('TRUNCATE TABLE "users" CASCADE');
    const provision = app.get(ProvisionUserUseCase);
    for (const [username, role] of [
      ['mestre', 'master'],
      ['jogador1', 'player'],
      ['jogador2', 'player'],
    ] as const) {
      await provision.execute({
        username,
        displayName: username,
        role,
        password: PASSWORD,
        resetPassword: true,
      });
      await login(username);
    }
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a handshake without a valid token', async () => {
    await expect(open(undefined)).rejects.toThrow('UNAUTHORIZED');
    await expect(open('aaa.bbb.ccc')).rejects.toThrow('UNAUTHORIZED');
  });

  it('refuses a handshake from an unknown origin', async () => {
    await expect(
      open(sessions.mestre.token, 'https://evil.example'),
    ).rejects.toBeDefined();
  });

  it('caps how many connections one account can hold', async () => {
    for (let tab = 0; tab < MAX_CONNECTIONS_PER_USER; tab++) {
      await open(sessions.jogador2.token);
    }

    const extra = io(`${baseUrl}/table`, {
      transports: ['websocket'],
      auth: { token: sessions.jogador2.token },
      extraHeaders: { Origin: ALLOWED_ORIGIN },
      reconnection: false,
      forceNew: true,
    });
    sockets.push(extra);
    const limit = await next<{ limit: number }>(extra, 'session:limit');
    expect(limit.limit).toBe(MAX_CONNECTIONS_PER_USER);
    await next(extra, 'disconnect');
    expect(extra.connected).toBe(false);
  });

  it('sends a snapshot with members but no credentials', async () => {
    const { snapshot } = await open(sessions.jogador1.token);

    expect(snapshot.you.role).toBe('player');
    expect(snapshot.online).toContain(sessions.jogador1.userId);
    expect(snapshot.members).toHaveLength(3);
    for (const member of snapshot.members) {
      expect(Object.keys(member).sort()).toEqual(['displayName', 'id', 'role']);
    }
  });

  it('runs the full token lifecycle with permissions and broadcasts', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    const other = await open(sessions.jogador2.token);

    const refused = await send(player.socket, 'token:create', {
      label: 'Intruso',
      kind: 'agent',
      col: 0,
      row: 0,
    });
    expect(refused.error?.code).toBe('TOKEN_FORBIDDEN');

    const playerSeesCreation = next<TokenData>(player.socket, 'token:created');
    const created = await send<TokenData>(master.socket, 'token:create', {
      label: 'Dante',
      kind: 'agent',
      ownerId: sessions.jogador1.userId,
      col: 1,
      row: 1,
    });
    expect(created.ok).toBe(true);
    const tokenId = created.data!.id;
    expect((await playerSeesCreation).id).toBe(tokenId);

    const masterSeesDrag = next<Record<string, unknown>>(
      master.socket,
      'token:dragged',
    );
    await send(player.socket, 'token:drag', { id: tokenId, col: 2, row: 1 });
    expect(await masterSeesDrag).toEqual({
      id: tokenId,
      by: sessions.jogador1.userId,
      col: 2,
      row: 1,
    });

    const masterSeesMove = next<TokenData>(master.socket, 'token:updated');
    const moved = await send<TokenData>(player.socket, 'token:move', {
      id: tokenId,
      col: 3,
      row: 1,
    });
    expect(moved.data).toMatchObject({ col: 3, row: 1, version: 2 });
    expect(await masterSeesMove).toMatchObject({ col: 3, version: 2 });

    const stolen = await send(other.socket, 'token:move', {
      id: tokenId,
      col: 9,
      row: 9,
    });
    expect(stolen.error?.code).toBe('TOKEN_FORBIDDEN');

    const otherSeesDeletion = next<{ id: string }>(
      other.socket,
      'token:deleted',
    );
    expect(
      (await send(master.socket, 'token:delete', { id: tokenId })).ok,
    ).toBe(true);
    expect(await otherSeesDeletion).toEqual({ id: tokenId });
  });

  it('keeps hidden tokens between the masters until revealed', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    const playerEvents: string[] = [];
    player.socket.onAny((event: string) => playerEvents.push(event));

    const created = await send<TokenData & { hidden: boolean; icon: string }>(
      master.socket,
      'token:create',
      {
        label: 'Dragão',
        kind: 'threat',
        icon: 'dragon-head',
        hidden: true,
        ownerId: sessions.jogador1.userId,
        col: 4,
        row: 4,
      },
    );
    expect(created.data).toMatchObject({ hidden: true, icon: 'dragon-head' });
    const tokenId = created.data!.id;

    const late = await open(sessions.jogador2.token);
    expect(late.snapshot.tokens.some((token) => token.id === tokenId)).toBe(
      false,
    );
    const masterAgain = await open(sessions.mestre.token);
    expect(
      masterAgain.snapshot.tokens.some((token) => token.id === tokenId),
    ).toBe(true);

    const peek = await send(player.socket, 'token:move', {
      id: tokenId,
      col: 0,
      row: 0,
    });
    expect(peek.error?.code).toBe('TOKEN_NOT_FOUND');

    const playerSeesReveal = next<TokenData>(player.socket, 'token:updated');
    await send(master.socket, 'token:update', { id: tokenId, hidden: false });
    expect(await playerSeesReveal).toMatchObject({
      id: tokenId,
      hidden: false,
    });
    expect(playerEvents.filter((event) => event.startsWith('token:'))).toEqual([
      'token:updated',
    ]);

    const playerSeesHide = next<{ id: string }>(player.socket, 'token:deleted');
    await send(master.socket, 'token:update', { id: tokenId, hidden: true });
    expect(await playerSeesHide).toEqual({ id: tokenId });

    const unknownIcon = await send(master.socket, 'token:update', {
      id: tokenId,
      icon: 'unicorn',
    });
    expect(unknownIcon.error?.code).toBe('INVALID_PAYLOAD');

    await send(master.socket, 'token:delete', { id: tokenId });
  });

  it('sends an anonymous token to players while its name is hidden', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);

    const playerSeesCreation = next<TokenData & { label: string }>(
      player.socket,
      'token:created',
    );
    const created = await send<TokenData & { label: string; sex: string }>(
      master.socket,
      'token:create',
      {
        label: 'Kian',
        kind: 'agent',
        icon: 'raven',
        sex: 'male',
        nameHidden: true,
        emitsLight: false,
        ownerId: sessions.jogador1.userId,
        col: 6,
        row: 6,
      },
    );
    expect(created.data).toMatchObject({ label: 'Kian', sex: 'male' });
    expect(await playerSeesCreation).toMatchObject({
      label: '???',
      kind: 'npc',
      icon: null,
      sex: null,
    });

    const moved = await send<{ label: string }>(player.socket, 'token:move', {
      id: created.data!.id,
      col: 7,
      row: 6,
    });
    expect(moved.data?.label).toBe('???');

    const late = await open(sessions.jogador2.token);
    const snapshotLabel = late.snapshot.tokens.find(
      (token) => token.id === created.data!.id,
    ) as { label?: string; emitsLight?: boolean } | undefined;
    expect(snapshotLabel?.label).toBe('???');
    expect(snapshotLabel?.emitsLight).toBe(false);

    const playerSeesName = next<Record<string, unknown>>(
      player.socket,
      'token:updated',
    );
    await send(master.socket, 'token:update', {
      id: created.data!.id,
      nameHidden: false,
    });
    expect(await playerSeesName).toMatchObject({
      label: 'Kian',
      kind: 'agent',
      icon: 'raven',
      sex: 'male',
    });

    const badSex = await send(master.socket, 'token:update', {
      id: created.data!.id,
      sex: 'robot',
    });
    expect(badSex.error?.code).toBe('INVALID_PAYLOAD');

    await send(master.socket, 'token:delete', { id: created.data!.id });
  });

  it('shares drawings and rulers with the whole table', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    const other = await open(sessions.jogador2.token);

    const otherSeesStroke = next<DrawingData>(other.socket, 'drawing:created');
    const stroke = await send<DrawingData>(player.socket, 'drawing:create', {
      shape: 'free',
      color: 'lavender',
      width: 4,
      points: [0, 0, 1.005, 1, 2, 1.5],
    });
    expect(stroke.data).toMatchObject({
      authorId: sessions.jogador1.userId,
      color: 'lavender',
      points: [0, 0, 1, 1, 2, 1.5],
    });
    expect((await otherSeesStroke).id).toBe(stroke.data!.id);

    const badColor = await send(player.socket, 'drawing:create', {
      shape: 'free',
      color: '#ff00ff',
      width: 4,
      points: [0, 0, 1, 1],
    });
    expect(badColor.error?.code).toBe('INVALID_PAYLOAD');

    const arrow = await send<DrawingData>(master.socket, 'drawing:create', {
      shape: 'arrow',
      color: 'rose',
      width: 8,
      points: [3, 3, 6, 4],
    });

    const late = await open(sessions.jogador2.token);
    expect(late.snapshot.drawings.map((drawing) => drawing.id)).toEqual([
      stroke.data!.id,
      arrow.data!.id,
    ]);

    const refused = await send(other.socket, 'drawing:erase', {
      ids: [stroke.data!.id],
    });
    expect(refused.error?.code).toBe('DRAWING_FORBIDDEN');
    const notAllowed = await send(player.socket, 'drawing:clear', {
      scope: 'all',
    });
    expect(notAllowed.error?.code).toBe('DRAWING_FORBIDDEN');

    const otherSeesErase = next<{ by: string; ids: string[] }>(
      other.socket,
      'drawing:erased',
    );
    const erased = await send(player.socket, 'drawing:erase', {
      ids: [stroke.data!.id],
    });
    expect(erased.ok).toBe(true);
    expect(await otherSeesErase).toEqual({
      by: sessions.jogador1.userId,
      ids: [stroke.data!.id],
    });

    const masterSeesRuler = next<Record<string, unknown>>(
      master.socket,
      'ruler:moved',
    );
    await send(player.socket, 'ruler:move', {
      fromCol: 0,
      fromRow: 0,
      toCol: 4,
      toRow: 2,
    });
    expect(await masterSeesRuler).toEqual({
      by: sessions.jogador1.userId,
      fromCol: 0,
      fromRow: 0,
      toCol: 4,
      toRow: 2,
    });
    const masterSeesRulerEnd = next<{ by: string }>(
      master.socket,
      'ruler:cleared',
    );
    await send(player.socket, 'ruler:clear', {});
    expect(await masterSeesRulerEnd).toEqual({
      by: sessions.jogador1.userId,
    });

    const cleared = await send<{ ids: string[] }>(
      master.socket,
      'drawing:clear',
      { scope: 'all' },
    );
    expect(cleared.data?.ids).toEqual([arrow.data!.id]);
  });

  it('delivers chat and rolls only to who may see them', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    const other = await open(sessions.jogador2.token);

    const inbox = new Map<Socket, MessageData[]>();
    for (const { socket } of [master, player, other]) {
      inbox.set(socket, []);
      socket.on('chat:message', (message: MessageData) =>
        inbox.get(socket)!.push(message),
      );
    }

    const hidden = await send<MessageData>(master.socket, 'dice:roll', {
      expression: '1d20+2',
      label: 'Percepção da ameaça',
      visibility: 'gm',
    });
    expect(hidden.ok).toBe(true);
    expect(hidden.data!.roll!.total).toBeGreaterThanOrEqual(3);
    expect(hidden.data!.roll!.total).toBeLessThanOrEqual(22);

    const whisper = await send<MessageData>(player.socket, 'chat:send', {
      text: 'tenho um plano',
      visibility: 'whisper',
      recipientId: sessions.jogador2.userId,
    });
    expect(whisper.ok).toBe(true);

    const test = await send<MessageData>(other.socket, 'dice:roll', {
      expression: '3d20kh1+5',
      label: 'Ocultismo',
      visibility: 'public',
    });
    const d20 = test.data!.roll!.terms[0];
    expect(d20.rolls).toHaveLength(3);
    expect(d20.rolls!.filter((die) => die.kept)).toHaveLength(1);

    const last = 'fim da cena';
    const everyoneGotLast = [master, player, other].map(({ socket }) =>
      until<MessageData>(socket, 'chat:message', (m) => m.text === last),
    );
    await send(master.socket, 'chat:send', {
      text: last,
      visibility: 'public',
    });
    await Promise.all(everyoneGotLast);

    const ids = (socket: Socket) => inbox.get(socket)!.map((m) => m.id);
    const lastId = inbox.get(master.socket)!.at(-1)!.id;
    expect(ids(master.socket)).toEqual([
      hidden.data!.id,
      test.data!.id,
      lastId,
    ]);
    expect(ids(player.socket)).toEqual([
      whisper.data!.id,
      test.data!.id,
      lastId,
    ]);
    expect(ids(other.socket)).toEqual([
      whisper.data!.id,
      test.data!.id,
      lastId,
    ]);

    const rejoined = await open(sessions.jogador1.token);
    expect(rejoined.snapshot.messages.map((m) => m.id)).toEqual([
      whisper.data!.id,
      test.data!.id,
      lastId,
    ]);
  });

  it('refuses invalid dice and whispers', async () => {
    const { socket } = await open(sessions.jogador1.token);

    const tooManyFaces = await send(socket, 'dice:roll', {
      expression: '1d1000',
      visibility: 'public',
    });
    const noRecipient = await send(socket, 'chat:send', {
      text: 'oi',
      visibility: 'whisper',
    });
    const toSelf = await send(socket, 'chat:send', {
      text: 'oi',
      visibility: 'whisper',
      recipientId: sessions.jogador1.userId,
    });

    expect(tooManyFaces.error?.code).toBe('INVALID_DICE');
    expect(noRecipient.error?.code).toBe('INVALID_PAYLOAD');
    expect(toSelf.error?.code).toBe('INVALID_MESSAGE');
  });

  it('lets only the master clear the chat for everyone', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    await send(player.socket, 'chat:send', {
      text: 'mensagem antiga',
      visibility: 'public',
    });

    const refused = await send(player.socket, 'chat:clear', {});
    expect(refused.error?.code).toBe('CHAT_FORBIDDEN');

    const playerSeesClear = next<{ by: string }>(player.socket, 'chat:cleared');
    const cleared = await send<{ removed: number }>(
      master.socket,
      'chat:clear',
      {},
    );
    expect(cleared.ok).toBe(true);
    expect(cleared.data!.removed).toBeGreaterThan(0);
    expect((await playerSeesClear).by).toBe(sessions.mestre.userId);

    const rejoined = await open(sessions.jogador1.token);
    expect(rejoined.snapshot.messages).toEqual([]);
  });

  it('rejects malformed and unexpected payloads', async () => {
    const { socket } = await open(sessions.mestre.token);

    const wrongType = await send(socket, 'token:create', {
      label: 'X',
      kind: 'agent',
      col: 'a',
      row: 0,
    });
    const extraField = await send(socket, 'token:create', {
      label: 'X',
      kind: 'agent',
      col: 0,
      row: 0,
      version: 99,
    });
    const notAnObject = await send(socket, 'token:move', 'drop table');

    for (const result of [wrongType, extraField, notAnObject]) {
      expect(result.error?.code).toBe('INVALID_PAYLOAD');
    }
  });

  it('tells the others when a player leaves', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador2.token);

    const playerId = sessions.jogador2.userId;
    const wentOffline = until<{ online: string[] }>(
      master.socket,
      'presence:changed',
      ({ online }) => !online.includes(playerId),
    );
    player.socket.disconnect();

    expect((await wentOffline).online).toContain(sessions.mestre.userId);
  });

  it('throttles a socket that floods events', async () => {
    const { socket } = await open(sessions.mestre.token);

    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        send(socket, 'token:delete', {
          id: '00000000-0000-4000-8000-000000000000',
        }),
      ),
    );

    expect(
      results.some((result) => result.error?.code === 'RATE_LIMITED'),
    ).toBe(true);
  });

  it('keeps sheets between their owner and the master, and links tokens to them', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    const other = await open(sessions.jogador2.token);
    const otherEvents: string[] = [];
    other.socket.onAny((event: string) => otherEvents.push(event));

    const masterSeesSheet = next<SheetData>(master.socket, 'sheet:created');
    const created = await send<SheetData>(player.socket, 'sheet:create', {
      data: {
        identity: { name: 'Kian', className: 'Espadachim' },
        attributes: { strength: 14 },
        skills: { arcana: 2 },
      },
    });
    expect(created.data).toMatchObject({
      ownerId: sessions.jogador1.userId,
      kind: 'agent',
      data: {
        identity: { name: 'Kian', className: 'Espadachim' },
        attributes: { strength: 14 },
        skills: { arcana: 2 },
      },
    });
    const sheetId = created.data!.id;
    expect((await masterSeesSheet).id).toBe(sheetId);

    const playerSeesDamage = next<SheetData>(player.socket, 'sheet:updated');
    await send(master.socket, 'sheet:update', {
      id: sheetId,
      data: { status: { hp: { current: 4, max: 20 } } },
    });
    expect((await playerSeesDamage).data.status.hp).toEqual({
      current: 4,
      max: 20,
    });

    const peek = await send(other.socket, 'sheet:update', {
      id: sheetId,
      data: { goal: 'espiar' },
    });
    expect(peek.error?.code).toBe('SHEET_NOT_FOUND');
    const late = await open(sessions.jogador2.token);
    expect(late.snapshot.sheets).toEqual([]);
    const rejoined = await open(sessions.jogador1.token);
    expect(rejoined.snapshot.sheets.map((sheet) => sheet.id)).toEqual([
      sheetId,
    ]);

    const token = await send<TokenData & { sheetId: string }>(
      master.socket,
      'token:create',
      {
        label: 'Kian',
        kind: 'agent',
        ownerId: sessions.jogador1.userId,
        sheetId,
        col: 9,
        row: 9,
      },
    );
    expect(token.data?.sheetId).toBe(sheetId);

    const otherSeesRename = next<TokenData>(other.socket, 'token:updated');
    await send(player.socket, 'sheet:update', {
      id: sheetId,
      data: { identity: { name: 'Kian', codename: 'Corvo' } },
    });
    expect(await otherSeesRename).toMatchObject({
      id: token.data!.id,
      label: 'Corvo',
    });

    const otherLosesToken = next<{ id: string }>(other.socket, 'token:deleted');
    const hiddenByPlayer = await send(player.socket, 'sheet:update', {
      id: sheetId,
      hidden: true,
    });
    expect(hiddenByPlayer.error?.code).toBe('SHEET_FORBIDDEN');
    await send(master.socket, 'sheet:update', { id: sheetId, hidden: true });
    expect(await otherLosesToken).toEqual({ id: token.data!.id });

    const otherSeesStats = next<{ id: string; stats: unknown }>(
      other.socket,
      'sheet:stats',
    );
    await send(master.socket, 'sheet:update', {
      id: sheetId,
      hidden: false,
      statsHidden: false,
    });
    expect(await otherSeesStats).toEqual({
      id: sheetId,
      stats: { id: sheetId, hp: { current: 4, max: 20 }, defense: 10 },
    });
    const watcher = await open(sessions.jogador2.token);
    expect(
      (watcher.snapshot as unknown as { sheetStats: { id: string }[] })
        .sheetStats,
    ).toEqual([expect.objectContaining({ id: sheetId })]);

    const ghost = await send(master.socket, 'token:create', {
      label: 'Fantasma',
      kind: 'npc',
      sheetId: '00000000-0000-4000-8000-000000000000',
      col: 9,
      row: 10,
    });
    expect(ghost.error?.code).toBe('INVALID_TOKEN');

    const playerSeesRemoval = next<{ id: string }>(
      player.socket,
      'sheet:deleted',
    );
    expect(
      (await send(master.socket, 'sheet:delete', { id: sheetId })).ok,
    ).toBe(true);
    expect(await playerSeesRemoval).toEqual({ id: sheetId });
    const afterDelete = await open(sessions.mestre.token);
    const linked = afterDelete.snapshot.tokens.find(
      (item) => item.id === token.data!.id,
    ) as { sheetId?: string | null } | undefined;
    expect(linked?.sheetId).toBeNull();
    expect(otherEvents.filter((event) => event.startsWith('sheet:'))).toEqual([
      'sheet:stats',
      'sheet:stats',
    ]);

    await send(master.socket, 'token:delete', { id: token.data!.id });
  });

  it('makes spammers wait before sending or rolling again', async () => {
    const spammer = await open(sessions.jogador2.token);

    const sends = [];
    for (let index = 0; index < 5; index++) {
      sends.push(
        await send<MessageData>(spammer.socket, 'chat:send', {
          text: `spam ${index}`,
          visibility: 'public',
        }),
      );
    }
    expect(sends.slice(0, 4).every((result) => result.ok)).toBe(true);
    const refused = sends[4] as Ack<MessageData> & {
      error?: { retryAfterMs?: number };
    };
    expect(refused.error?.code).toBe('COOLDOWN');
    expect(refused.error?.retryAfterMs).toBeGreaterThan(0);
    expect(refused.error?.retryAfterMs).toBeLessThanOrEqual(2000);

    const roll = await send(spammer.socket, 'dice:roll', {
      expression: '1d20',
      visibility: 'public',
    });
    expect(roll.ok).toBe(true);
  });

  it('runs a fight in initiative order and keeps hidden combatants from players', async () => {
    const master = await open(sessions.mestre.token);
    const player = await open(sessions.jogador1.token);
    await app
      .get(DataSource)
      .query(`UPDATE "table_settings" SET "fog_enabled" = false`);
    await send(master.socket, 'combat:end', {});

    const hero = await send<TokenData>(master.socket, 'token:create', {
      label: 'Kael',
      kind: 'agent',
      ownerId: sessions.jogador1.userId,
      col: 0,
      row: 0,
    });
    const lich = await send<TokenData>(master.socket, 'token:create', {
      label: 'Lich',
      kind: 'threat',
      col: 3,
      row: 0,
    });
    const heroId = hero.data!.id;
    const lichId = lich.data!.id;

    const refused = await send(player.socket, 'combat:join', {
      tokenIds: [heroId],
    });
    expect(refused.error?.code).toBe('COMBAT_FORBIDDEN');

    const playerSeesJoin = next<{ combat: CombatData }>(
      player.socket,
      'combat:changed',
    );
    await send(master.socket, 'combat:join', { tokenIds: [heroId, lichId] });
    expect(
      (await playerSeesJoin).combat.combatants.map(({ tokenId }) => tokenId),
    ).toEqual([heroId, lichId]);

    const playerSeesAmbush = next<{ combat: CombatData }>(
      player.socket,
      'combat:changed',
    );
    await send(master.socket, 'combat:update', {
      tokenId: lichId,
      initiative: 20,
      hidden: true,
    });
    expect((await playerSeesAmbush).combat.combatants).toEqual([
      { tokenId: heroId, initiative: null, hidden: false },
    ]);

    await send(master.socket, 'combat:update', {
      tokenId: heroId,
      initiative: 12,
    });
    const playerSeesStart = next<{ combat: CombatData }>(
      player.socket,
      'combat:changed',
    );
    const started = await send<CombatData>(master.socket, 'combat:start', {});
    expect(started.data).toMatchObject({ round: 1, turnId: lichId });
    expect((await playerSeesStart).combat).toMatchObject({
      round: 1,
      turnId: null,
    });

    const passed = await send<CombatData>(master.socket, 'combat:step', {
      step: 1,
    });
    expect(passed.data?.turnId).toBe(heroId);
    const stale = await send(master.socket, 'combat:step', {
      step: 1,
      round: 1,
      turnId: lichId,
    });
    expect(stale.error?.code).toBe('INVALID_COMBAT');

    const late = await open(sessions.jogador2.token);
    expect(
      (late.snapshot as Snapshot & { combat: CombatData }).combat,
    ).toMatchObject({
      round: 1,
      turnId: heroId,
      combatants: [{ tokenId: heroId }],
    });

    const invalid = await send(master.socket, 'combat:update', {
      tokenId: heroId,
      initiative: 1.5,
    });
    expect(invalid.error?.code).toBe('INVALID_PAYLOAD');

    const notYours = await send(player.socket, 'combat:pass', {
      tokenId: lichId,
    });
    expect(notYours.error?.code).toBe('COMBAT_FORBIDDEN');
    const ownTurn = await send<CombatData>(player.socket, 'combat:pass', {
      tokenId: heroId,
    });
    expect(ownTurn.data).toMatchObject({ round: 2, turnId: null });

    const playerSeesRemoval = until<{ combat: CombatData }>(
      player.socket,
      'combat:changed',
      ({ combat }) => combat.combatants.length === 0,
    );
    await send(master.socket, 'token:delete', { id: heroId });
    expect((await playerSeesRemoval).combat.turnId).toBeNull();

    const ended = await send<CombatData>(master.socket, 'combat:end', {});
    expect(ended.data).toEqual({ round: 0, turnId: null, combatants: [] });
    await send(master.socket, 'token:delete', { id: lichId });
  });
});
