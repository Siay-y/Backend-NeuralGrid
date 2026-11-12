import { type Combat, IDLE_COMBAT } from '../domain/entities/combat';
import { CombatRepository } from '../domain/repositories/combat.repository';

export class InMemoryCombatRepository extends CombatRepository {
  private combat: Combat = IDLE_COMBAT;

  get(): Promise<Combat> {
    return Promise.resolve(this.combat);
  }

  save(combat: Combat): Promise<void> {
    this.combat = {
      ...combat,
      combatants: combat.combatants.map((combatant) => ({ ...combatant })),
    };
    return Promise.resolve();
  }
}
