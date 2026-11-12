import type { Combat } from '../entities/combat';

export abstract class CombatRepository {
  abstract get(): Promise<Combat>;
  abstract save(combat: Combat): Promise<void>;
}
