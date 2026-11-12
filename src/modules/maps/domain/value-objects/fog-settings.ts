import { InvalidMapError } from '../errors/invalid-map.error';

export interface FogSettings {
  enabled: boolean;
  radius: number;
  memory: boolean;
}

export const FOG_RADIUS = { min: 2, max: 20, default: 6 } as const;

export const DEFAULT_FOG: FogSettings = {
  enabled: false,
  radius: FOG_RADIUS.default,
  memory: false,
};

export function editFog(
  current: FogSettings,
  changes: Partial<FogSettings>,
): FogSettings {
  const radius = changes.radius ?? current.radius;
  if (
    !Number.isInteger(radius) ||
    radius < FOG_RADIUS.min ||
    radius > FOG_RADIUS.max
  ) {
    throw new InvalidMapError(
      `O alcance da luz precisa ficar entre ${FOG_RADIUS.min} e ${FOG_RADIUS.max} quadrados`,
    );
  }
  return {
    enabled: changes.enabled ?? current.enabled,
    radius,
    memory: changes.memory ?? current.memory,
  };
}
