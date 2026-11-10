import type { User } from '../domain/entities/user';
import { UserRepository } from '../domain/repositories/user.repository';

export class InMemoryUserRepository extends UserRepository {
  private readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByUsername(username: string): Promise<User | null> {
    const match = [...this.users.values()].find(
      (user) => user.username === username,
    );
    return Promise.resolve(match ?? null);
  }

  save(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }
}
