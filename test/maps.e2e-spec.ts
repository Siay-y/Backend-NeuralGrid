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
import { MAP_LIMITS } from '../src/modules/maps/domain/value-objects/map-image';
import { ProvisionUserUseCase } from '../src/modules/users/application/use-cases/provision-user.use-case';

const ALLOWED_ORIGIN = 'http://localhost:4200';
const PASSWORD = 'senha-longa-para-testes-e2e';

interface AreaData {
  id: string;
  name: string;
  hidden: boolean;
}

interface MapData {
  id: string;
  name: string;
  active: boolean;
  areas: AreaData[];
}

interface SceneData {
  scene: { id: string; areas: Record<string, unknown>[] } | null;
}

interface Ack<T> {
  ok: boolean;
  data?: T;
  error?: { code: string };
}

function png(width: number, height: number, padding = 0): Buffer {
  const bytes = Buffer.alloc(33 + padding);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

let ipCounter = 0;

describe('Maps (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let baseUrl: string;
  const sessions: Record<string, string> = {};
  const sockets: Socket[] = [];

  const ip = () => `192.0.2.${++ipCounter}`;

  const upload = (
    token: string | undefined,
    image: Buffer,
    options: {
      name?: string;
      filename?: string;
      type?: string;
      mapId?: string;
      center?: [number, number];
    } = {},
  ) => {
    const path = options.mapId
      ? `/api/maps/${options.mapId}/areas`
      : '/api/maps';
    const call = request(server).post(path).set('X-Forwarded-For', ip());
    if (token) {
      void call.set('Authorization', `Bearer ${token}`);
    }
    void call.field('name', options.name ?? 'Covil do dragão');
    if (options.center) {
      void call
        .field('centerCol', String(options.center[0]))
        .field('centerRow', String(options.center[1]));
    }
    return call
      .attach('image', image, {
        filename: options.filename ?? 'mapa.png',
        contentType: options.type ?? 'image/png',
      })
      .attach('thumbnail', png(320, 213), {
        filename: 'mini.png',
        contentType: 'image/png',
      });
  };

  const fetchImage = (
    token: string | undefined,
    id: string,
    kind = 'image',
  ) => {
    const call = request(server).get(`/api/maps/areas/${id}/${kind}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const open = (
    token: string,
  ): Promise<{ socket: Socket; snapshot: Record<string, unknown> }> =>
    new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/table`, {
        transports: ['websocket'],
        auth: { token },
        extraHeaders: { Origin: ALLOWED_ORIGIN },
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      socket.once('table:snapshot', (snapshot: Record<string, unknown>) =>
        resolve({ socket, snapshot }),
      );
      socket.once('connect_error', reject);
    });

  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

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
    server = app.getHttpServer() as App;
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const data = app.get(DataSource);
    await data.query('TRUNCATE TABLE "maps" CASCADE');
    await data.query('TRUNCATE TABLE "users" CASCADE');
    await data.query(
      'UPDATE "table_settings" SET "fog_enabled" = false, "light_radius" = 6',
    );
    const provision = app.get(ProvisionUserUseCase);
    for (const [username, role] of [
      ['mestre', 'master'],
      ['jogador1', 'player'],
    ] as const) {
      await provision.execute({
        username,
        displayName: username,
        role,
        password: PASSWORD,
        resetPassword: true,
      });
      const { body } = await request(server)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip())
        .send({ username, password: PASSWORD })
        .expect(200);
      sessions[username] = body.accessToken;
    }
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    const data = app.get(DataSource);
    await data.query('TRUNCATE TABLE "maps" CASCADE');
    await data.query(
      'UPDATE "table_settings" SET "fog_enabled" = false, "light_radius" = 6',
    );
    await app.close();
  });

  it('accepts a map only from the master and only as a real image', async () => {
    await upload(undefined, png(2100, 1400)).expect(401);
    await upload(sessions.jogador1, png(2100, 1400)).expect(403);

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    );
    const disguised = await upload(sessions.mestre, svg, {
      filename: 'mapa.png',
      type: 'image/png',
    }).expect(422);
    expect(disguised.body.error).toBe('INVALID_MAP');

    await upload(
      sessions.mestre,
      png(100, 100, MAP_LIMITS.imageBytes + 1),
    ).expect(413);

    const created = await upload(sessions.mestre, png(2100, 1400)).expect(201);
    expect(created.body).toMatchObject({
      name: 'Covil do dragão',
      active: false,
      areas: [{ width: 2100, height: 1400, cell: 70, hidden: false }],
    });

    await upload(sessions.jogador1, png(700, 700), {
      mapId: created.body.id,
    }).expect(403);
    await upload(sessions.mestre, png(700, 700), {
      mapId: created.body.id,
      center: [Number.NaN, 2],
    }).expect(400);
    const area = await upload(sessions.mestre, png(700, 700), {
      mapId: created.body.id,
      name: 'Torre',
      center: [10, 0],
    }).expect(201);
    expect(area.body.areas[1]).toMatchObject({
      name: 'Torre',
      col: 5,
      row: -5,
      hidden: true,
    });
  });

  it('serves the image privately and keeps prepared maps away from players', async () => {
    const { body: map } = await upload(sessions.mestre, png(800, 600)).expect(
      201,
    );
    const areaId = (map as MapData).areas[0].id;

    await fetchImage(undefined, areaId).expect(401);
    await fetchImage(sessions.jogador1, areaId).expect(404);
    await fetchImage(sessions.jogador1, areaId, 'thumbnail').expect(403);
    await fetchImage(sessions.mestre, 'not-a-uuid').expect(400);

    const image = await fetchImage(sessions.mestre, areaId).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toBe(
      'private, max-age=31536000, immutable',
    );
    expect(image.headers['content-security-policy']).toBe("default-src 'none'");
    expect(image.headers['x-content-type-options']).toBe('nosniff');
  });

  it('changes the scene for everyone and lets players load only visible areas', async () => {
    const { body: created } = await upload(sessions.mestre, png(1400, 1400), {
      name: 'Floresta',
    }).expect(201);
    const { body: map } = await upload(sessions.mestre, png(700, 700), {
      mapId: (created as MapData).id,
      name: 'Clareira',
    }).expect(201);
    const [entrance, glade] = (map as MapData).areas;
    const master = await open(sessions.mestre);
    const player = await open(sessions.jogador1);
    expect(player.snapshot.maps).toEqual([]);
    expect(
      (master.snapshot.maps as MapData[]).some((entry) => entry.id === map.id),
    ).toBe(true);

    const refused = await send(player.socket, 'map:activate', { id: map.id });
    expect(refused.error?.code).toBe('MAP_FORBIDDEN');

    const shown = next<SceneData>(player.socket, 'scene:changed');
    const masterScene = next<SceneData>(master.socket, 'scene:changed');
    expect((await send(master.socket, 'map:activate', { id: map.id })).ok).toBe(
      true,
    );
    const { scene } = await shown;
    expect(scene).toEqual({
      id: map.id,
      areas: [
        {
          id: entrance.id,
          width: 1400,
          height: 1400,
          col: -10,
          row: -10,
          cell: 70,
        },
      ],
    });
    expect(JSON.stringify(scene)).not.toContain('Floresta');
    expect((await masterScene).scene?.areas).toHaveLength(2);
    await fetchImage(sessions.jogador1, entrance.id).expect(200);
    await fetchImage(sessions.jogador1, glade.id).expect(404);

    const revealed = next<SceneData>(player.socket, 'scene:changed');
    const reveal = await send<MapData>(master.socket, 'area:update', {
      id: glade.id,
      hidden: false,
      col: 3,
      cell: 100,
    });
    expect(reveal.ok).toBe(true);
    expect((await revealed).scene?.areas).toEqual([
      expect.objectContaining({ id: entrance.id }),
      expect.objectContaining({ id: glade.id, col: 3, cell: 100 }),
    ]);
    await fetchImage(sessions.jogador1, glade.id).expect(200);

    const injected = await send(master.socket, 'area:update', {
      id: glade.id,
      cell: '100; DROP',
    });
    expect(injected.error?.code).toBe('INVALID_PAYLOAD');

    const rejoined = await open(sessions.jogador1);
    expect((rejoined.snapshot.scene as SceneData['scene'])?.areas).toHaveLength(
      2,
    );

    const cleared = next<SceneData>(player.socket, 'scene:changed');
    expect((await send(master.socket, 'map:delete', { id: map.id })).ok).toBe(
      true,
    );
    expect((await cleared).scene).toBeNull();
    await fetchImage(sessions.jogador1, entrance.id).expect(404);
  });

  it('shares the fog settings and lets only the master change them', async () => {
    const master = await open(sessions.mestre);
    const player = await open(sessions.jogador1);
    expect(player.snapshot.fog).toEqual({ enabled: false, radius: 6 });

    const refused = await send(player.socket, 'fog:update', { enabled: true });
    expect(refused.error?.code).toBe('MAP_FORBIDDEN');
    const broken = await send(master.socket, 'fog:update', { radius: 50 });
    expect(broken.error?.code).toBe('INVALID_PAYLOAD');

    const changed = next<{ fog: unknown }>(player.socket, 'fog:changed');
    const saved = await send(master.socket, 'fog:update', {
      enabled: true,
      radius: 8,
    });
    expect(saved.data).toEqual({ enabled: true, radius: 8 });
    expect((await changed).fog).toEqual({ enabled: true, radius: 8 });

    const rejoined = await open(sessions.jogador1);
    expect(rejoined.snapshot.fog).toEqual({ enabled: true, radius: 8 });
  });
});
