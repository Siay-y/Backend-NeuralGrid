import { InvalidMapError } from '../errors/invalid-map.error';
import { MAP_LIMITS } from '../value-objects/map-image';

export interface BattleMapProps {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeMapName(value: unknown): string {
  const name =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (name.length === 0) {
    throw new InvalidMapError('Dê um nome ao mapa');
  }
  return name.slice(0, MAP_LIMITS.name);
}

export class BattleMap {
  private constructor(private readonly props: Readonly<BattleMapProps>) {}

  static create(input: { id: string; name: unknown; now: Date }): BattleMap {
    return new BattleMap({
      id: input.id,
      name: normalizeMapName(input.name),
      active: false,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: BattleMapProps): BattleMap {
    return new BattleMap({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: unknown, now: Date): BattleMap {
    return new BattleMap({
      ...this.props,
      name: normalizeMapName(name),
      updatedAt: now,
    });
  }

  withActive(active: boolean): BattleMap {
    return new BattleMap({ ...this.props, active });
  }
}
