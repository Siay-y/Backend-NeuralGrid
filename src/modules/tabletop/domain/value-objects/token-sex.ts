export const TOKEN_SEXES = ['female', 'male', 'other'] as const;

export type TokenSex = (typeof TOKEN_SEXES)[number];

export function isTokenSex(value: unknown): value is TokenSex {
  return (
    typeof value === 'string' &&
    (TOKEN_SEXES as readonly string[]).includes(value)
  );
}
