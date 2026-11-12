import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { COMBAT_LIMITS } from '../../../domain/entities/combat';

const ID_MESSAGE = 'Identificador de token inválido';
const LIST_MESSAGE = `Escolha de 1 a ${COMBAT_LIMITS.combatants} tokens`;
const INITIATIVE_MESSAGE = `A iniciativa precisa ser um inteiro entre ${COMBAT_LIMITS.minInitiative} e ${COMBAT_LIMITS.maxInitiative}`;

export class CombatTokensDto {
  @IsArray({ message: LIST_MESSAGE })
  @ArrayMinSize(1, { message: LIST_MESSAGE })
  @ArrayMaxSize(COMBAT_LIMITS.combatants, { message: LIST_MESSAGE })
  @IsUUID('4', { each: true, message: ID_MESSAGE })
  tokenIds: string[];
}

export class RollInitiativeDto {
  @IsOptional()
  @IsArray({ message: LIST_MESSAGE })
  @ArrayMaxSize(COMBAT_LIMITS.combatants, { message: LIST_MESSAGE })
  @IsUUID('4', { each: true, message: ID_MESSAGE })
  tokenIds?: string[];
}

export class CombatantIdDto {
  @IsUUID('4', { message: ID_MESSAGE })
  tokenId: string;
}

export class UpdateCombatantDto extends CombatantIdDto {
  @IsOptional()
  @ValidateIf((dto: UpdateCombatantDto) => dto.initiative !== null)
  @IsInt({ message: INITIATIVE_MESSAGE })
  @Min(COMBAT_LIMITS.minInitiative, { message: INITIATIVE_MESSAGE })
  @Max(COMBAT_LIMITS.maxInitiative, { message: INITIATIVE_MESSAGE })
  initiative?: number | null;

  @IsOptional()
  @IsBoolean({
    message: 'Informe se fica oculto dos jogadores com verdadeiro ou falso',
  })
  hidden?: boolean;
}

export class StepTurnDto {
  @IsIn([1, -1], { message: 'O passo do turno precisa ser 1 ou -1' })
  step: 1 | -1;

  @IsOptional()
  @IsInt({ message: 'A rodada precisa ser um inteiro' })
  @Min(0, { message: 'A rodada precisa ser um inteiro' })
  round?: number;

  @IsOptional()
  @ValidateIf((dto: StepTurnDto) => dto.turnId !== null)
  @IsUUID('4', { message: ID_MESSAGE })
  turnId?: string | null;
}
