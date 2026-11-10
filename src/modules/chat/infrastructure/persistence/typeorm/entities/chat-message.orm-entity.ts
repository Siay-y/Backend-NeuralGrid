import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../../../../users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import type { RollRecord } from '../../../../domain/entities/chat-message';
import {
  MESSAGE_KINDS,
  MESSAGE_VISIBILITIES,
  type MessageKind,
  type MessageVisibility,
} from '../../../../domain/value-objects/message-visibility';

@Entity({ name: 'chat_messages' })
@Check(
  'ck_chat_messages_payload',
  `("kind" = 'text' AND "text" IS NOT NULL AND "roll" IS NULL) OR ("kind" = 'roll' AND "roll" IS NOT NULL AND "text" IS NULL)`,
)
@Check(
  'ck_chat_messages_text_not_blank',
  `"text" IS NULL OR length(btrim("text")) > 0`,
)
export class ChatMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_chat_messages',
  })
  id: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_chat_messages_author',
  })
  author?: UserOrmEntity | null;

  @Column({ type: 'enum', enum: MESSAGE_KINDS, enumName: 'chat_message_kind' })
  kind: MessageKind;

  @Column({ type: 'varchar', length: 500, nullable: true })
  text: string | null;

  @Column({ type: 'jsonb', nullable: true })
  roll: RollRecord | null;

  @Column({
    type: 'enum',
    enum: MESSAGE_VISIBILITIES,
    enumName: 'chat_message_visibility',
  })
  visibility: MessageVisibility;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'recipient_id',
    foreignKeyConstraintName: 'fk_chat_messages_recipient',
  })
  recipient?: UserOrmEntity | null;

  @Index('ix_chat_messages_created_at')
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
