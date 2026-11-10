import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  USER_ROLES,
  type UserRole,
} from '../../../../domain/value-objects/user-role';

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  username: string;

  @Column({ name: 'display_name', type: 'varchar', length: 64 })
  displayName: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'user_role' })
  role: UserRole;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
