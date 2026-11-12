import type { FogSettings } from '../value-objects/fog-settings';

export abstract class FogSettingsRepository {
  abstract get(): Promise<FogSettings>;
  abstract save(fog: FogSettings): Promise<void>;
}
