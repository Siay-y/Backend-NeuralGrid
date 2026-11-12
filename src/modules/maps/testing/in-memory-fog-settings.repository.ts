import { FogSettingsRepository } from '../domain/repositories/fog-settings.repository';
import {
  DEFAULT_FOG,
  type FogSettings,
} from '../domain/value-objects/fog-settings';

export class InMemoryFogSettingsRepository extends FogSettingsRepository {
  private fog: FogSettings = { ...DEFAULT_FOG };

  get(): Promise<FogSettings> {
    return Promise.resolve({ ...this.fog });
  }

  save(fog: FogSettings): Promise<void> {
    this.fog = { ...fog };
    return Promise.resolve();
  }
}
