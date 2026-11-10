import type { User } from '../../domain/entities/user';
import type { UserRole } from '../../domain/value-objects/user-role';

export interface UserView {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}
