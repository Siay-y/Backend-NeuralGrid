import { InvalidTokenError } from '../errors/invalid-token.error';
import { Token } from './token';

const base = {
  id: 'token-1',
  label: '  Arthur Cervero ',
  kind: 'agent' as const,
  icon: null,
  sex: null,
  hidden: false,
  nameHidden: false,
  emitsLight: true,
  ownerId: 'player-1',
  sheetId: null,
  col: 2,
  row: -3,
  size: 1,
  now: new Date('2026-01-01T00:00:00Z'),
};

describe('Token', () => {
  it('creates a token with a trimmed label at version 1', () => {
    const token = Token.create(base);

    expect(token.label).toBe('Arthur Cervero');
    expect(token.version).toBe(1);
    expect(token.isOwnedBy('player-1')).toBe(true);
  });

  it('bumps the version on every move', () => {
    const moved = Token.create(base).moveTo(5, 5, new Date());

    expect(moved.col).toBe(5);
    expect(moved.version).toBe(2);
  });

  it.each([
    ['an empty label', { label: '   ' }],
    ['a label longer than 32 characters', { label: 'x'.repeat(33) }],
    ['an unknown kind', { kind: 'dragon' as never }],
    ['an unknown icon', { icon: 'unicorn' as never }],
    ['an unknown sex', { sex: 'robot' as never }],
    ['a size above 4', { size: 5 }],
    ['a fractional size', { size: 1.5 }],
    ['a position outside the grid', { col: 501 }],
    ['a fractional position', { row: 0.5 }],
  ])('rejects %s', (_case, override) => {
    expect(() => Token.create({ ...base, ...override })).toThrow(
      InvalidTokenError,
    );
  });

  it('keeps a known icon and the hidden flag', () => {
    const token = Token.create({ ...base, icon: 'dragon-head', hidden: true });

    expect(token.icon).toBe('dragon-head');
    expect(token.hidden).toBe(true);
  });

  it('validates moves against the grid limits', () => {
    expect(() => Token.create(base).moveTo(0, -501, new Date())).toThrow(
      InvalidTokenError,
    );
  });
});
