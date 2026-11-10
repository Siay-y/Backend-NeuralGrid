import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  USER_ROLES,
  type UserRole,
} from '../../../../domain/value-objects/user-role';

@Entity({ name: 'users' })
@Unique('uq_users_username', ['username'])
@Check(
  'ck_users_username_format',
  `"username" ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'`,
)
@Check('ck_users_display_name_not_blank', `length(btrim("display_name")) > 0`)
@Index('uq_users_single_master', ['role'], {
  unique: true,
  where: `"role" = 'master'`,
})
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  id: string;

  @Column({ type: 'varchar', length: 32 })
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
