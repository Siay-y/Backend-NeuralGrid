import { Injectable } from '@nestjs/common';
import type { MessageView } from '../../../chat/application/dtos/message-view';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import type {
  SheetChange,
  SheetView,
} from '../../../sheets/application/dtos/sheet-view';
import {
  AdjustHitPointsUseCase,
  FindSheetUseCase,
} from '../../../sheets/application/use-cases/sheet-use-cases';
import { isBeyondDeath } from '../../../sheets/domain/value-objects/sheet-data';
import type { Token } from '../../domain/entities/token';
import { CharacterDeadError } from '../../domain/errors/character-dead.error';
import { InvalidStatusError } from '../../domain/errors/invalid-status.error';
import { StatusForbiddenError } from '../../domain/errors/status-forbidden.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import {
  applyStatus,
  DEATH_SAVE_TARGET,
  DEATH_SAVES,
  deathOf,
  failDeathSave,
  fallOf,
  removeStatus,
  type TokenStatus,
} from '../../domain/value-objects/token-status';
import type { StatusChange } from '../dtos/status-view';
import { HIDDEN_TOKEN_NAME } from '../dtos/token-view';
import { StatusBook } from './status-use-cases';

export type DeathEventKind = 'fell' | 'save' | 'killed' | 'revived';

export interface DeathEvent {
  kind: DeathEventKind;
  tokenId: string;
  label: string;
  ownerId: string | null;
  hidden: boolean;
  nameHidden: boolean;
  attemptsLeft: number;
  failures: number;
  roll: number | null;
  success: boolean | null;
  message: MessageView | null;
}

export interface DeathOutcome {
  changes: StatusChange[];
  events: DeathEvent[];
  sheets: SheetChange[];
  messages: MessageView[];
}

export function noDeaths(): DeathOutcome {
  return { changes: [], events: [], sheets: [], messages: [] };
}

export function mergeDeaths(...outcomes: DeathOutcome[]): DeathOutcome {
  return {
    changes: outcomes.flatMap(({ changes }) => changes),
    events: outcomes.flatMap(({ events }) => events),
    sheets: outcomes.flatMap(({ sheets }) => sheets),
    messages: outcomes.flatMap(({ messages }) => messages),
  };
}

function deathEvent(
  kind: DeathEventKind,
  token: Token,
  statuses: readonly TokenStatus[],
  extra: Partial<DeathEvent> = {},
): DeathEvent {
  const death = deathOf(statuses);
  return {
    kind,
    tokenId: token.id,
    label: token.label,
    ownerId: token.ownerId,
    hidden: token.hidden,
    nameHidden: token.nameHidden,
    attemptsLeft: death?.turns ?? 0,
    failures: !death
      ? 0
      : death.turns === null
        ? DEATH_SAVES
        : Math.max(0, DEATH_SAVES - death.turns),
    roll: null,
    success: null,
    message: null,
    ...extra,
  };
}

function assertMaster(actor: TableActor): void {
  if (actor.role !== 'master') {
    throw new StatusForbiddenError();
  }
}

// A fallen character cannot act: the player can neither move the token nor
// edit the sheet, so nobody heals their own character out of death.
@Injectable()
export class DeathWatch {
  constructor(
    private readonly book: StatusBook,
    private readonly tokens: TokenRepository,
    private readonly findSheet: FindSheetUseCase,
    private readonly adjustHitPoints: AdjustHitPointsUseCase,
    private readonly rollDice: RollDiceUseCase,
  ) {}

  async assertCanAct(actor: TableActor, tokenId: string): Promise<void> {
    if (actor.role !== 'master' && deathOf(await this.book.of(tokenId))) {
      throw new CharacterDeadError();
    }
  }

  async assertSheetAlive(actor: TableActor, sheetId: string): Promise<void> {
    if (actor.role === 'master') {
      return;
    }
    for (const token of await this.tokens.findBySheet(sheetId)) {
      if (deathOf(await this.book.of(token.id))) {
        throw new CharacterDeadError();
      }
    }
  }

  async review(sheet: SheetView): Promise<DeathOutcome> {
    const outcome = noDeaths();
    const beyond = isBeyondDeath(sheet.data);
    const healed = sheet.data.status.hp.current > 0;
    for (const token of await this.tokens.findBySheet(sheet.id)) {
      const found: { kind: DeathEventKind | null } = { kind: null };
      const change = await this.book.edit(token.id, (statuses) => {
        const death = deathOf(statuses);
        if (!death && beyond) {
          try {
            const fall = fallOf(token.kind);
            const next = applyStatus(statuses, fall);
            found.kind = fall.turns === null ? 'killed' : 'fell';
            return next;
          } catch (error) {
            if (error instanceof InvalidStatusError) {
              return statuses;
            }
            throw error;
          }
        }
        if (death && death.turns !== null && healed) {
          found.kind = 'revived';
          return removeStatus(statuses, 'death');
        }
        return statuses;
      });
      if (found.kind) {
        outcome.changes.push(change);
        outcome.events.push(deathEvent(found.kind, token, change.statuses));
      }
    }
    return outcome;
  }

  async announce(change: StatusChange): Promise<DeathOutcome> {
    const death = deathOf(change.statuses);
    const token = await this.tokens.findById(change.tokenId);
    if (!death || !token) {
      return noDeaths();
    }
    const kind = death.turns === null ? 'killed' : 'fell';
    return {
      ...noDeaths(),
      events: [deathEvent(kind, token, change.statuses)],
    };
  }

  async revive(actor: TableActor, tokenId: string): Promise<DeathOutcome> {
    assertMaster(actor);
    const change = await this.book.edit(tokenId, (statuses) =>
      removeStatus(statuses, 'death'),
    );
    const token = await this.tokens.findById(tokenId);
    if (!token) {
      return noDeaths();
    }
    const sheet = await this.restoreLife(token);
    return {
      changes: [change],
      events: [deathEvent('revived', token, change.statuses)],
      sheets: sheet ? [sheet] : [],
      messages: [],
    };
  }

  async reviveSheet(actor: TableActor, sheetId: string): Promise<DeathOutcome> {
    assertMaster(actor);
    const outcomes: DeathOutcome[] = [];
    for (const token of await this.tokens.findBySheet(sheetId)) {
      if (deathOf(await this.book.of(token.id))) {
        outcomes.push(await this.revive(actor, token.id));
      }
    }
    if (outcomes.length === 0) {
      throw new InvalidStatusError('Esse personagem não está morto');
    }
    return mergeDeaths(...outcomes);
  }

  async startTurn(
    author: TableActor,
    tokenId: string,
    secret: boolean,
  ): Promise<DeathOutcome> {
    const token = await this.tokens.findById(tokenId);
    const death = deathOf(await this.book.of(tokenId));
    if (!token) {
      return noDeaths();
    }
    const sheet = token.sheetId
      ? await this.findSheet.execute(token.sheetId)
      : null;
    if (!death) {
      return sheet ? this.review(sheet) : noDeaths();
    }
    if (death.turns === null) {
      return noDeaths();
    }
    if (sheet && sheet.data.status.hp.current > 0) {
      return this.review(sheet);
    }

    const hidden = secret || token.hidden;
    const message = await this.rollDice.execute(author, {
      expression: '1d20',
      label: `Teste de morte · ${token.nameHidden && !hidden ? HIDDEN_TOKEN_NAME : token.label}`,
      visibility: hidden ? 'gm' : 'public',
      recipientId: null,
    });
    const roll = message.roll?.total ?? 0;
    const success = roll >= DEATH_SAVE_TARGET;
    const change = await this.book.edit(tokenId, (statuses) =>
      success ? removeStatus(statuses, 'death') : failDeathSave(statuses),
    );
    const restored = success ? await this.restoreLife(token) : null;
    return {
      changes: [change],
      events: [
        deathEvent('save', token, change.statuses, {
          roll,
          success,
          ...(success
            ? { failures: Math.max(0, DEATH_SAVES - (death.turns ?? 0)) }
            : {}),
          message: hidden ? null : message,
        }),
      ],
      sheets: restored ? [restored] : [],
      messages: [message],
    };
  }

  async incapacitated(tokenId: string): Promise<boolean> {
    return !!deathOf(await this.book.of(tokenId));
  }

  private async restoreLife(token: Token): Promise<SheetChange | null> {
    const sheet = token.sheetId
      ? await this.findSheet.execute(token.sheetId)
      : null;
    const { current } = sheet?.data.status.hp ?? { current: 1 };
    return sheet && current <= 0
      ? this.adjustHitPoints.execute(sheet.id, 1 - current)
      : null;
  }
}
