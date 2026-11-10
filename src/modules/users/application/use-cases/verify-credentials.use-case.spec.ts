import { User } from '../../domain/entities/user';
import { Username } from '../../domain/value-objects/username';
import { FakePasswordHasher } from '../../testing/fake-password-hasher';
import { InMemoryUserRepository } from '../../testing/in-memory-user.repository';
import { VerifyCredentialsUseCase } from './verify-credentials.use-case';

describe('VerifyCredentialsUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let useCase: VerifyCredentialsUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    useCase = new VerifyCredentialsUseCase(users, hasher);

    await users.save(
      User.create({
        id: 'user-1',
        username: Username.create('mestre'),
        displayName: 'Mestre',
        role: 'master',
        passwordHash: await hasher.hash('senha-correta-123'),
        now: new Date(),
      }),
    );
  });

  it('returns the user view when the password matches', async () => {
    const result = await useCase.execute({
      username: 'mestre',
      password: 'senha-correta-123',
    });

    expect(result).toEqual({
      id: 'user-1',
      username: 'mestre',
      displayName: 'Mestre',
      role: 'master',
    });
  });

  it('normalizes the username before looking it up', async () => {
    const result = await useCase.execute({
      username: '  MESTRE ',
      password: 'senha-correta-123',
    });

    expect(result?.id).toBe('user-1');
  });

  it('returns null when the password does not match', async () => {
    const result = await useCase.execute({
      username: 'mestre',
      password: 'errada',
    });

    expect(result).toBeNull();
  });

  it('still verifies a hash when the username does not exist', async () => {
    const result = await useCase.execute({
      username: 'fantasma',
      password: 'qualquer',
    });

    expect(result).toBeNull();
    expect(hasher.verifiedHashes).toHaveLength(1);
    expect(hasher.verifiedHashes[0]).not.toBe('hashed:senha-correta-123');
  });

  it('never exposes the password hash', async () => {
    const result = await useCase.execute({
      username: 'mestre',
      password: 'senha-correta-123',
    });

    expect(result).not.toHaveProperty('passwordHash');
  });
});
