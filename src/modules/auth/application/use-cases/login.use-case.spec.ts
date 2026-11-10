import { VerifyCredentialsUseCase } from '../../../users/application/use-cases/verify-credentials.use-case';
import { User } from '../../../users/domain/entities/user';
import { Username } from '../../../users/domain/value-objects/username';
import { FakePasswordHasher } from '../../../users/testing/fake-password-hasher';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import type { AccessTokenClaims } from '../dtos/access-token-payload';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import {
  AccessTokenIssuer,
  type IssuedAccessToken,
} from '../ports/access-token-issuer';
import { LoginUseCase } from './login.use-case';

class RecordingTokenIssuer extends AccessTokenIssuer {
  readonly issued: AccessTokenClaims[] = [];

  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    this.issued.push(claims);
    return Promise.resolve({
      token: `token-for-${claims.sub}`,
      expiresIn: 3600,
    });
  }
}

describe('LoginUseCase', () => {
  let tokens: RecordingTokenIssuer;
  let useCase: LoginUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    tokens = new RecordingTokenIssuer();
    useCase = new LoginUseCase(
      new VerifyCredentialsUseCase(users, hasher),
      tokens,
    );

    await users.save(
      User.create({
        id: 'player-1',
        username: Username.create('jogador1'),
        displayName: 'Jogador 1',
        role: 'player',
        passwordHash: await hasher.hash('senha-correta-123'),
        now: new Date(),
      }),
    );
  });

  it('issues a bearer token carrying id, username and role', async () => {
    const session = await useCase.execute({
      username: 'jogador1',
      password: 'senha-correta-123',
    });

    expect(tokens.issued).toEqual([
      { sub: 'player-1', username: 'jogador1', role: 'player' },
    ]);
    expect(session).toEqual({
      accessToken: 'token-for-player-1',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 'player-1',
        username: 'jogador1',
        displayName: 'Jogador 1',
        role: 'player',
      },
    });
  });

  it('rejects a wrong password without issuing a token', async () => {
    await expect(
      useCase.execute({ username: 'jogador1', password: 'errada' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(tokens.issued).toHaveLength(0);
  });

  it('answers an unknown user with the same error as a wrong password', async () => {
    const unknown = useCase.execute({
      username: 'ninguem',
      password: 'senha-correta-123',
    });

    await expect(unknown).rejects.toThrow(
      new InvalidCredentialsError().message,
    );
  });
});
