export const TOKEN_KINDS = ['agent', 'npc', 'threat'] as const;

export type TokenKind = (typeof TOKEN_KINDS)[number];

export function isTokenKind(value: unknown): value is TokenKind {
  return (
    typeof value === 'string' &&
    (TOKEN_KINDS as readonly string[]).includes(value)
  );
}
