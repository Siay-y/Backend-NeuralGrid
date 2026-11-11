import { InvalidDrawingError } from '../errors/invalid-drawing.error';
import { Drawing, DRAWING_MAX_POINTS } from './drawing';

const base = {
  id: 'drawing-1',
  authorId: 'player-1',
  shape: 'free',
  color: 'rose',
  width: 4,
  points: [0, 0, 1.234, 2.345],
  now: new Date('2026-11-10T12:00:00Z'),
};

describe('Drawing', () => {
  it('rounds the points to two decimals', () => {
    const drawing = Drawing.create(base);

    expect(drawing.points).toEqual([0, 0, 1.23, 2.35]);
    expect(drawing.isAuthoredBy('player-1')).toBe(true);
  });

  it('needs exactly two points for arrows, rectangles and circles', () => {
    for (const shape of ['arrow', 'rect', 'ellipse']) {
      expect(() =>
        Drawing.create({ ...base, shape, points: [0, 0, 1, 1, 2, 2] }),
      ).toThrow(InvalidDrawingError);
      expect(
        Drawing.create({ ...base, shape, points: [0, 0, 3, 2] }).shape,
      ).toBe(shape);
    }
  });

  it('limits the size of a free stroke', () => {
    const tooLong = Array.from(
      { length: (DRAWING_MAX_POINTS + 1) * 2 },
      (_, index) => index % 10,
    );

    expect(() => Drawing.create({ ...base, points: tooLong })).toThrow(
      InvalidDrawingError,
    );
    expect(() => Drawing.create({ ...base, points: [0, 0, 1] })).toThrow(
      InvalidDrawingError,
    );
  });

  it('refuses unknown styles and points outside the grid', () => {
    expect(() => Drawing.create({ ...base, color: '#ff0000' })).toThrow(
      InvalidDrawingError,
    );
    expect(() => Drawing.create({ ...base, width: 5 })).toThrow(
      InvalidDrawingError,
    );
    expect(() => Drawing.create({ ...base, shape: 'star' })).toThrow(
      InvalidDrawingError,
    );
    expect(() => Drawing.create({ ...base, points: [0, 0, 501, 0] })).toThrow(
      InvalidDrawingError,
    );
    expect(() =>
      Drawing.create({ ...base, points: [0, 0, Number.NaN, 0] }),
    ).toThrow(InvalidDrawingError);
  });
});
