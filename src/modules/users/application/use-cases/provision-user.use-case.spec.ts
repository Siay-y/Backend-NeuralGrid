import { InvalidUserProfileError } from '../../domain/errors/invalid-user-profile.error';
import { InvalidUsernameError } from '../../domain/errors/invalid-username.error';
import { FakePasswordHasher } from '../../testing/fake-password-hasher';
import { InMemoryUserRepository } from '../../testing/in-memory-user.repository';
import { ProvisionUserUseCase } from './provision-user.use-case';

describe('ProvisionUserUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: ProvisionUserUseCase;

  const base = {
    username: 'Jogador1',
    displayName: 'Jogador 1',
    role: 'player' as const,
    password: 'uma-senha-longa-o-bastante',
    resetPassword: false,
  };

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new ProvisionUserUseCase(users, new FakePasswordHasher());
  });

  it('creates the user with a normalized username and a hashed password', async () => {
    const outcome = await useCase.execute(base);
    const stored = await users.findByUsername('jogador1');

    expect(outcome).toBe('created');
    expect(stored?.passwordHash).toBe('hashed:uma-senha-longa-o-bastante');
  });

  it('keeps an existing account untouched without the reset flag', async () => {
    await useCase.execute(base);

    const outcome = await useCase.execute({
      ...base,
      password: 'outra-senha-bem-longa',
    });
    const stored = await users.findByUsername('jogador1');

    expect(outcome).toBe('unchanged');
    expect(stored?.passwordHash).toBe('hashed:uma-senha-longa-o-bastante');
  });

  it('rotates the password when the reset flag is set', async () => {
    await useCase.execute(base);

    const outcome = await useCase.execute({
      ...base,
      password: 'outra-senha-bem-longa',
      resetPassword: true,
    });
    const stored = await users.findByUsername('jogador1');

    expect(outcome).toBe('updated');
    expect(stored?.passwordHash).toBe('hashed:outra-senha-bem-longa');
  });

  it('rejects passwords shorter than the policy', async () => {
    await expect(
      useCase.execute({ ...base, password: 'curta' }),
    ).rejects.toBeInstanceOf(InvalidUserProfileError);
  });

  it('rejects usernames outside the allowed pattern', async () => {
    await expect(
      useCase.execute({ ...base, username: 'nome com espaço' }),
    ).rejects.toBeInstanceOf(InvalidUsernameError);
  });
});
