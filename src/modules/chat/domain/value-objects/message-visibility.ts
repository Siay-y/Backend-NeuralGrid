export const MESSAGE_VISIBILITIES = ['public', 'gm', 'whisper'] as const;

export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export function isMessageVisibility(
  value: unknown,
): value is MessageVisibility {
  return (
    typeof value === 'string' &&
    (MESSAGE_VISIBILITIES as readonly string[]).includes(value)
  );
}

export const MESSAGE_KINDS = ['text', 'roll'] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];
