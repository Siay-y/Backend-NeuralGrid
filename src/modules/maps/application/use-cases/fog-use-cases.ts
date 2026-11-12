import { Injectable } from '@nestjs/common';
import { type MapActor, MapPolicy } from '../../domain/policies/map-policy';
import { FogMemoryRepository } from '../../domain/repositories/fog-memory.repository';
import { FogSettingsRepository } from '../../domain/repositories/fog-settings.repository';
import { MapRepository } from '../../domain/repositories/map.repository';
import {
  flatten,
  FOG_MEMORY,
  type FogMemoryView,
  type LightStep,
  trailPoints,
} from '../../domain/value-objects/fog-memory';
import {
  editFog,
  type FogSettings,
} from '../../domain/value-objects/fog-settings';

@Injectable()
export class GetFogUseCase {
  constructor(private readonly settings: FogSettingsRepository) {}

  execute(): Promise<FogSettings> {
    return this.settings.get();
  }
}

@Injectable()
export class UpdateFogUseCase {
  constructor(private readonly settings: FogSettingsRepository) {}

  async execute(
    actor: MapActor,
    changes: Partial<FogSettings>,
  ): Promise<FogSettings> {
    MapPolicy.assertCanManage(actor);
    const next = editFog(await this.settings.get(), changes);
    await this.settings.save(next);
    return next;
  }
}

@Injectable()
export class GetFogMemoryUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly memory: FogMemoryRepository,
  ) {}

  async execute(): Promise<FogMemoryView | null> {
    const map = await this.maps.findActive();
    if (!map) {
      return null;
    }
    return { mapId: map.id, points: flatten(await this.memory.list(map.id)) };
  }
}

@Injectable()
export class ExploreFogUseCase {
  constructor(
    private readonly settings: FogSettingsRepository,
    private readonly maps: MapRepository,
    private readonly memory: FogMemoryRepository,
  ) {}

  async execute(steps: readonly LightStep[]): Promise<FogMemoryView | null> {
    if (steps.length === 0) {
      return null;
    }
    const fog = await this.settings.get();
    if (!fog.enabled || !fog.memory) {
      return null;
    }
    const map = await this.maps.findActive();
    if (!map) {
      return null;
    }
    const room = FOG_MEMORY.maxPointsPerMap - (await this.memory.count(map.id));
    if (room <= 0) {
      return null;
    }
    const points = trailPoints(steps, fog.radius).slice(0, room);
    const added = await this.memory.add(map.id, points);
    return added.length > 0 ? { mapId: map.id, points: flatten(added) } : null;
  }
}

@Injectable()
export class ForgetFogUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly memory: FogMemoryRepository,
  ) {}

  async execute(actor: MapActor): Promise<FogMemoryView | null> {
    MapPolicy.assertCanManage(actor);
    const map = await this.maps.findActive();
    if (!map) {
      return null;
    }
    await this.memory.clear(map.id);
    return { mapId: map.id, points: [] };
  }
}
