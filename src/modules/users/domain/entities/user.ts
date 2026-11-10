import { InvalidUserProfileError } from '../errors/invalid-user-profile.error';
import { isUserRole, UserRole } from '../value-objects/user-role';
import { Username } from '../value-objects/username';

export const DISPLAY_NAME_MAX_LENGTH = 64;

export interface UserProps {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUserProps {
  id: string;
  username: Username;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  now: Date;
}

function assertDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0 || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new InvalidUserProfileError(
      `O nome de exibição precisa ter entre 1 e ${DISPLAY_NAME_MAX_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

function assertRole(role: unknown): UserRole {
  if (!isUserRole(role)) {
    throw new InvalidUserProfileError(`Papel desconhecido: "${String(role)}"`);
  }
  return role;
}

export class User {
  private constructor(private readonly props: Readonly<UserProps>) {}

  static create(input: NewUserProps): User {
    return new User({
      id: input.id,
      username: input.username.value,
      displayName: assertDisplayName(input.displayName),
      role: assertRole(input.role),
      passwordHash: input.passwordHash,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get username(): string {
    return this.props.username;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isMaster(): boolean {
    return this.props.role === 'master';
  }

  withProfile(displayName: string, role: UserRole, now: Date): User {
    return new User({
      ...this.props,
      displayName: assertDisplayName(displayName),
      role: assertRole(role),
      updatedAt: now,
    });
  }

  withPasswordHash(passwordHash: string, now: Date): User {
    return new User({ ...this.props, passwordHash, updatedAt: now });
  }
}
