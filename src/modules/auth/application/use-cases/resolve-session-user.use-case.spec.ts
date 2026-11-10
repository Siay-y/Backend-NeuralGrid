import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { User } from '../../../users/domain/entities/user';
import { Username } from '../../../users/domain/value-objects/username';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { InvalidSessionError } from '../errors/invalid-session.error';
import { ResolveSessionUserUseCase } from './resolve-session-user.use-case';

describe('ResolveSessionUserUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: ResolveSessionUserUseCase;
  let player: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    useCase = new ResolveSessionUserUseCase(new GetUserByIdUseCase(users));
    player = User.create({
      id: 'player-1',
      username: Username.create('jogador1'),
      displayName: 'Jogador 1',
      role: 'player',
      passwordHash: 'hash',
      now: new Date(),
    });
    await users.save(player);
  });

  it('resolves the current account from valid claims', async () => {
    const user = await useCase.execute({
      sub: 'player-1',
      username: 'jogador1',
      role: 'player',
    });

    expect(user.displayName).toBe('Jogador 1');
  });

  it('rejects claims for an account that no longer exists', async () => {
    await expect(
      useCase.execute({
        sub: 'removido',
        username: 'jogador1',
        role: 'player',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('rejects tokens issued before a role change', async () => {
    await users.save(player.withProfile('Jogador 1', 'master', new Date()));

    await expect(
      useCase.execute({
        sub: 'player-1',
        username: 'jogador1',
        role: 'player',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionError);
  });
});
