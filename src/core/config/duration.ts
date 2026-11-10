const UNIT_IN_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

type DurationUnit = keyof typeof UNIT_IN_SECONDS;

export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Duração inválida: "${duration}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_IN_SECONDS[unit as DurationUnit];
}
