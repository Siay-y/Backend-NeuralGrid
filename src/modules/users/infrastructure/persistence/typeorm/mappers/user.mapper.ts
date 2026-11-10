import { User } from '../../../../domain/entities/user';
import { UserOrmEntity } from '../entities/user.orm-entity';

export const UserMapper = {
  toDomain(row: UserOrmEntity): User {
    return User.restore({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toOrm(user: User): UserOrmEntity {
    const row = new UserOrmEntity();
    row.id = user.id;
    row.username = user.username;
    row.displayName = user.displayName;
    row.role = user.role;
    row.passwordHash = user.passwordHash;
    row.createdAt = user.createdAt;
    row.updatedAt = user.updatedAt;
    return row;
  },
};
