import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../../../users/application/use-cases/provision-user.use-case';
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../../../../users/domain/value-objects/username';

export class LoginRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeUsername(value) : value,
  )
  @IsString({ message: 'Informe o usuário' })
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, {
    message: `O usuário precisa ter entre ${USERNAME_MIN_LENGTH} e ${USERNAME_MAX_LENGTH} caracteres`,
  })
  @Matches(USERNAME_PATTERN, {
    message:
      'O usuário aceita letras minúsculas, números, ponto, hífen e sublinhado',
  })
  username: string;

  @IsString({ message: 'Informe a senha' })
  @IsNotEmpty({ message: 'Informe a senha' })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `A senha aceita no máximo ${PASSWORD_MAX_LENGTH} caracteres`,
  })
  password: string;
}
