import { Injectable } from '@nestjs/common';
import type { MessageView } from '../../../chat/application/dtos/message-view';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import { AdjustHitPointsUseCase } from '../../../sheets/application/use-cases/sheet-use-cases';
import type { TableActor } from '../../domain/policies/token-policy';
import {
  passTurn,
  STATUS_AMOUNT,
  STATUS_LABEL,
  ticksEachTurn,
} from '../../domain/value-objects/token-status';
import { HIDDEN_TOKEN_NAME } from '../dtos/token-view';
import { type DeathOutcome, DeathWatch, mergeDeaths } from './death-use-cases';
import { StatusBook } from './status-use-cases';

export interface TurnStart {
  round: number;
  tokenId: string;
  secret: boolean;
}

export interface StatusTick extends DeathOutcome {
  incapacitated: boolean;
}

// Each token takes its effects once per round, so stepping back and forward
// again never rolls the same poison twice.
@Injectable()
export class TickStatusesUseCase {
  private readonly ticked = new Set<string>();

  constructor(
    private readonly book: StatusBook,
    private readonly rollDice: RollDiceUseCase,
    private readonly adjustHitPoints: AdjustHitPointsUseCase,
    private readonly deaths: DeathWatch,
  ) {}

  restart(): void {
    this.ticked.clear();
  }

  async execute(
    author: TableActor,
    turn: TurnStart,
  ): Promise<StatusTick | null> {
    const key = `${turn.round}:${turn.tokenId}`;
    if (this.ticked.has(key)) {
      return null;
    }
    this.ticked.add(key);
    if ((await this.book.of(turn.tokenId)).length === 0) {
      return null;
    }

    const messages: MessageView[] = [];
    const effect = { delta: 0, sheetId: null as string | null };
    const change = await this.book.edit(
      turn.tokenId,
      async (statuses, token) => {
        effect.sheetId = token.sheetId;
        const secret = turn.secret || token.hidden;
        const name =
          token.nameHidden && !secret ? HIDDEN_TOKEN_NAME : token.label;
        for (const status of statuses.filter(ticksEachTurn)) {
          const message = await this.rollDice.execute(author, {
            expression: status.amount ?? '',
            label: `${STATUS_LABEL[status.kind]} · ${name}`,
            visibility: secret ? 'gm' : 'public',
            recipientId: null,
          });
          messages.push(message);
          const total = Math.max(0, message.roll?.total ?? 0);
          effect.delta +=
            STATUS_AMOUNT[status.kind] === 'heal' ? total : -total;
        }
        return passTurn(statuses);
      },
    );
    const sheet =
      effect.sheetId !== null && effect.delta !== 0
        ? await this.adjustHitPoints.execute(effect.sheetId, effect.delta)
        : null;
    const death = await this.deaths.startTurn(
      author,
      turn.tokenId,
      turn.secret,
    );
    const outcome = mergeDeaths(
      {
        changes: [change],
        events: [],
        sheets: sheet ? [sheet] : [],
        messages,
      },
      death,
    );
    return {
      ...outcome,
      incapacitated: await this.deaths.incapacitated(turn.tokenId),
    };
  }
}
