import type { User } from '../entities/user';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByUsername(username: string): Promise<User | null>;
  abstract save(user: User): Promise<void>;
}
