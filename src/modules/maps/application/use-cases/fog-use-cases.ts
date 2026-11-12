import { Injectable } from '@nestjs/common';
import { type MapActor, MapPolicy } from '../../domain/policies/map-policy';
import { FogSettingsRepository } from '../../domain/repositories/fog-settings.repository';
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
