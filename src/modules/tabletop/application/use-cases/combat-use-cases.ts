import { Injectable } from '@nestjs/common';
import type { MessageView } from '../../../chat/application/dtos/message-view';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import { GetFogUseCase } from '../../../maps/application/use-cases/fog-use-cases';
import { FindSheetUseCase } from '../../../sheets/application/use-cases/sheet-use-cases';
import { attributeModifier } from '../../../sheets/domain/value-objects/sheet-data';
import {
  type Combat,
  type CombatantChanges,
  editCombatant,
  hasStarted,
  IDLE_COMBAT,
  joinCombat,
  leaveCombat,
  clampInitiative,
  initiativeExpression,
  startCombat,
  stepTurn,
} from '../../domain/entities/combat';
import type { Token } from '../../domain/entities/token';
import { CombatForbiddenError } from '../../domain/errors/combat-forbidden.error';
import { InvalidCombatError } from '../../domain/errors/invalid-combat.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { CombatRepository } from '../../domain/repositories/combat.repository';
import { TokenRepository } from '../../domain/repositories/token.repository';
import {
  type CombatViews,
  toCombatViews,
  withoutMissingTokens,
} from '../dtos/combat-view';

type CombatChange = (
  combat: Combat,
  tokens: ReadonlyMap<string, Token>,
) => Combat | Promise<Combat>;

function assertConducts(actor: TableActor): void {
  if (actor.role !== 'master') {
    throw new CombatForbiddenError();
  }
}

@Injectable()
export class CombatTracker {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly combats: CombatRepository,
    private readonly tokens: TokenRepository,
  ) {}

  async views(): Promise<CombatViews> {
    const [combat, tokens] = await Promise.all([
      this.combats.get(),
      this.tokenMap(),
    ]);
    return toCombatViews(combat, tokens);
  }

  async change(actor: TableActor, apply: CombatChange): Promise<CombatViews> {
    assertConducts(actor);
    return this.update(apply);
  }

  update(apply: CombatChange): Promise<CombatViews> {
    return this.serialize(() => this.write(apply));
  }

  drop(tokenIds: readonly string[]): Promise<CombatViews | null> {
    return this.serialize(async () => {
      const stored = await this.combats.get();
      if (
        !stored.combatants.some(({ tokenId }) => tokenIds.includes(tokenId))
      ) {
        return null;
      }
      return this.write((combat) => combat);
    });
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async write(apply: CombatChange): Promise<CombatViews> {
    const [stored, tokens] = await Promise.all([
      this.combats.get(),
      this.tokenMap(),
    ]);
    const next = await apply(withoutMissingTokens(stored, tokens), tokens);
    await this.combats.save(next);
    return toCombatViews(next, tokens);
  }

  private async tokenMap(): Promise<ReadonlyMap<string, Token>> {
    const tokens = await this.tokens.findAll();
    return new Map(tokens.map((token) => [token.id, token]));
  }
}

@Injectable()
export class GetCombatUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(): Promise<CombatViews> {
    return this.tracker.views();
  }
}

@Injectable()
export class JoinCombatUseCase {
  constructor(
    private readonly tracker: CombatTracker,
    private readonly getFog: GetFogUseCase,
  ) {}

  async execute(
    actor: TableActor,
    tokenIds: readonly string[],
  ): Promise<CombatViews> {
    const fog = await this.getFog.execute();
    return this.tracker.change(actor, (combat, tokens) =>
      joinCombat(
        combat,
        tokenIds.map((tokenId) => {
          const token = tokens.get(tokenId);
          if (!token) {
            throw new InvalidCombatError('Esse token não está mais na mesa');
          }
          const lit = token.ownerId !== null && token.emitsLight;
          return {
            tokenId,
            initiative: null,
            hidden: token.hidden || (fog.enabled && !lit),
          };
        }),
      ),
    );
  }
}

@Injectable()
export class EditCombatantUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(
    actor: TableActor,
    tokenId: string,
    changes: CombatantChanges,
  ): Promise<CombatViews> {
    return this.tracker.change(actor, (combat) =>
      editCombatant(combat, tokenId, changes),
    );
  }
}

@Injectable()
export class LeaveCombatUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(actor: TableActor, tokenId: string): Promise<CombatViews> {
    return this.tracker.change(actor, (combat) =>
      leaveCombat(combat, [tokenId]),
    );
  }
}

export interface InitiativeRolls {
  views: CombatViews;
  messages: MessageView[];
}

@Injectable()
export class RollInitiativeUseCase {
  constructor(
    private readonly tracker: CombatTracker,
    private readonly findSheet: FindSheetUseCase,
    private readonly rollDice: RollDiceUseCase,
  ) {}

  async execute(
    actor: TableActor,
    tokenIds: readonly string[] | null,
  ): Promise<InitiativeRolls> {
    const messages: MessageView[] = [];
    const views = await this.tracker.change(actor, async (combat, tokens) => {
      const targets = combat.combatants.filter(({ tokenId, initiative }) =>
        tokenIds === null ? initiative === null : tokenIds.includes(tokenId),
      );
      let next = combat;
      for (const { tokenId, hidden } of targets) {
        const token = tokens.get(tokenId);
        const sheet = token?.sheetId
          ? await this.findSheet.execute(token.sheetId)
          : null;
        if (!token || !sheet) {
          continue;
        }
        const secret = hidden || token.hidden;
        const name = token.nameHidden && !secret ? '???' : token.label;
        const message = await this.rollDice.execute(actor, {
          expression: initiativeExpression(
            attributeModifier(sheet.data.attributes.agility),
          ),
          label: `Iniciativa · ${name}`,
          visibility: secret ? 'gm' : 'public',
          recipientId: null,
        });
        messages.push(message);
        next = editCombatant(next, tokenId, {
          initiative: clampInitiative(message.roll?.total ?? 0),
        });
      }
      return next;
    });
    return { views, messages };
  }
}

@Injectable()
export class StartCombatUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(actor: TableActor): Promise<CombatViews> {
    return this.tracker.change(actor, (combat) => startCombat(combat));
  }
}

@Injectable()
export class StepTurnUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(
    actor: TableActor,
    step: 1 | -1,
    expected?: Pick<Combat, 'round' | 'turnId'>,
  ): Promise<CombatViews> {
    return this.tracker.change(actor, (combat) => {
      if (
        expected &&
        (combat.round !== expected.round || combat.turnId !== expected.turnId)
      ) {
        throw new InvalidCombatError('A vez já mudou');
      }
      return stepTurn(combat, step);
    });
  }
}

// A player may only end the turn of a visible token they own, and only while
// that token holds the turn, so nobody can skip someone else's turn.
@Injectable()
export class PassTurnUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(actor: TableActor, tokenId: string): Promise<CombatViews> {
    return this.tracker.update((combat, tokens) => {
      const token = tokens.get(tokenId);
      const owns =
        actor.role === 'master' ||
        (token !== undefined && !token.hidden && token.isOwnedBy(actor.id));
      if (!owns) {
        throw new CombatForbiddenError(
          'Você só finaliza o turno do seu personagem',
        );
      }
      if (!hasStarted(combat) || combat.turnId !== tokenId) {
        throw new InvalidCombatError('Não é a vez desse personagem');
      }
      return stepTurn(combat, 1);
    });
  }
}

@Injectable()
export class DropFromCombatUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(tokenIds: readonly string[]): Promise<CombatViews | null> {
    return this.tracker.drop(tokenIds);
  }
}

@Injectable()
export class EndCombatUseCase {
  constructor(private readonly tracker: CombatTracker) {}

  execute(actor: TableActor): Promise<CombatViews> {
    return this.tracker.change(actor, () => IDLE_COMBAT);
  }
}
