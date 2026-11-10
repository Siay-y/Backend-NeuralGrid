import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DICE_LIMITS } from '../../../../chat/domain/dice/dice-formula';
import {
  MESSAGE_TEXT_MAX_LENGTH,
  ROLL_LABEL_MAX_LENGTH,
} from '../../../../chat/domain/entities/chat-message';
import {
  MESSAGE_VISIBILITIES,
  type MessageVisibility,
} from '../../../../chat/domain/value-objects/message-visibility';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const VISIBILITY_MESSAGE = 'A visibilidade precisa ser public, gm ou whisper';
const RECIPIENT_MESSAGE = 'Escolha um destinatário da mesa para o sussurro';
const TEXT_MESSAGE = `A mensagem precisa ter entre 1 e ${MESSAGE_TEXT_MAX_LENGTH} caracteres`;
const EXPRESSION_MESSAGE = `A expressão precisa ter entre 1 e ${DICE_LIMITS.maxLength} caracteres`;
const LABEL_MESSAGE = `O nome da rolagem pode ter até ${ROLL_LABEL_MAX_LENGTH} caracteres`;

class AudienceDto {
  @IsIn(MESSAGE_VISIBILITIES, { message: VISIBILITY_MESSAGE })
  visibility: MessageVisibility;

  @ValidateIf(
    (dto: AudienceDto) =>
      dto.visibility === 'whisper' ||
      (dto.recipientId !== undefined && dto.recipientId !== null),
  )
  @IsUUID('4', { message: RECIPIENT_MESSAGE })
  recipientId?: string | null;
}

export class SendMessageDto extends AudienceDto {
  @Transform(trim)
  @IsString({ message: TEXT_MESSAGE })
  @Length(1, MESSAGE_TEXT_MAX_LENGTH, { message: TEXT_MESSAGE })
  text: string;
}

export class RollDiceDto extends AudienceDto {
  @Transform(trim)
  @IsString({ message: EXPRESSION_MESSAGE })
  @Length(1, DICE_LIMITS.maxLength, { message: EXPRESSION_MESSAGE })
  expression: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: LABEL_MESSAGE })
  @MaxLength(ROLL_LABEL_MAX_LENGTH, { message: LABEL_MESSAGE })
  label?: string | null;
}
