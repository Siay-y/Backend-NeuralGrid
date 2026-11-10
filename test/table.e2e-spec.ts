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
