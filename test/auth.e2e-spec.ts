import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/core/http/configure-http';
import { ProvisionUserUseCase } from '../src/modules/users/application/use-cases/provision-user.use-case';

const MASTER_PASSWORD = 'senha-do-mestre-para-testes';
const PLAYER_PASSWORD = 'senha-do-jogador-para-testes';

let clientCounter = 0;
const nextClientIp = (): string => `203.0.113.${++clientCounter}`;

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttp(app);
    await app.init();
    server = app.getHttpServer() as App;

    await app.get(DataSource).query('TRUNCATE TABLE "users" CASCADE');
    const provision = app.get(ProvisionUserUseCase);
    await provision.execute({
      username: 'mestre',
      displayName: 'Mestre',
      role: 'master',
      password: MASTER_PASSWORD,
      resetPassword: true,
    });
    await provision.execute({
      username: 'jogador1',
      displayName: 'Jogador 1',
      role: 'player',
      password: PLAYER_PASSWORD,
      resetPassword: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (body: object, ip = nextClientIp()) =>
    request(server)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send(body);

  it('issues a JWT for valid credentials', async () => {
    const response = await login({
      username: 'mestre',
      password: MASTER_PASSWORD,
    }).expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: { username: 'mestre', displayName: 'Mestre', role: 'master' },
    });
    expect(response.body).not.toHaveProperty('user.passwordHash');

    const [, payload] = (response.body.accessToken as string).split('.');
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as Record<string, unknown>;
    expect(claims).toMatchObject({
      sub: response.body.user.id,
      username: 'mestre',
      role: 'master',
      iss: 'neuralgrid-api',
      aud: 'neuralgrid-web',
    });
  });

  it('accepts the username in any letter case', async () => {
    await login({ username: '  Jogador1 ', password: PLAYER_PASSWORD }).expect(
      200,
    );
  });

  it('answers wrong password and unknown user identically', async () => {
    const wrongPassword = await login({
      username: 'mestre',
      password: 'errada',
    }).expect(401);
    const unknownUser = await login({
      username: 'ninguem',
      password: 'errada',
    }).expect(401);

    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.body).toEqual({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS',
      message: 'Usuário ou senha inválidos',
    });
  });

  it('rejects malformed payloads and unknown fields', async () => {
    await login({ username: 'mestre' }).expect(400);
    await login({ username: 'a b', password: 'x' }).expect(400);
    await login({
      username: 'mestre',
      password: MASTER_PASSWORD,
      role: 'master',
    }).expect(400);
  });

  it('protects private routes and accepts a valid bearer token', async () => {
    await request(server).get('/api/auth/me').expect(401);

    const { body } = await login({
      username: 'jogador1',
      password: PLAYER_PASSWORD,
    }).expect(200);
    const me = await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    expect(me.body).toEqual(body.user);
  });

  it('rejects a token whose signature was tampered with', async () => {
    const { body } = await login({
      username: 'jogador1',
      password: PLAYER_PASSWORD,
    }).expect(200);
    const [header, payload] = (body.accessToken as string).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        role: 'master',
      }),
    ).toString('base64url');

    await request(server)
      .get('/api/auth/me')
      .set(
        'Authorization',
        `Bearer ${header}.${forgedPayload}.assinatura-falsa`,
      )
      .expect(401);
  });

  it('blocks repeated attempts against the same account from many addresses', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await login({
        username: 'alvo',
        password: `tentativa-${attempt}`,
      }).expect(401);
    }

    const blocked = await login({
      username: 'alvo',
      password: 'mais-uma',
    }).expect(429);

    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.statusCode).toBe(429);
  });

  it('blocks a single address hammering different accounts', async () => {
    const ip = nextClientIp();
    for (let attempt = 0; attempt < 10; attempt++) {
      await login(
        { username: `conta${attempt}`, password: 'qualquer' },
        ip,
      ).expect(401);
    }

    await login({ username: 'mestre', password: MASTER_PASSWORD }, ip).expect(
      429,
    );
  });

  it('reports health without authentication', async () => {
    await request(server)
      .get('/api/health')
      .expect(200, { status: 'ok', database: 'up' });
  });
});
