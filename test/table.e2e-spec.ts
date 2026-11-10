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

const ALLOWED_ORIGIN = 'http://localhost:4200';
const PASSWORD = 'senha-longa-para-testes-e2e';

interface Snapshot {
  you: { id: string; role: string };
  tokens: Array<{ id: string }>;
  members: Array<Record<string, unknown>>;
  online: string[];
  messages: MessageData[];
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
});
