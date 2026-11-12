import { flatten, FOG_MEMORY, trailPoints } from './fog-memory';

const at = (col: number, row: number, size = 1) => ({ col, row, size });

describe('fog memory trail', () => {
  it('marks the center of a token that just appeared', () => {
    expect(trailPoints([{ from: null, to: at(2, 3) }], 6)).toEqual([
      { x2: 5, y2: 7 },
    ]);
    expect(trailPoints([{ from: null, to: at(0, 0, 2) }], 6)).toEqual([
      { x2: 2, y2: 2 },
    ]);
  });

  it('fills the way between two spots every half reach', () => {
    const points = trailPoints([{ from: at(0, 0), to: at(12, 0) }], 6);

    expect(points.map(({ x2 }) => x2)).toEqual([1, 7, 13, 19, 25]);
    expect(points.every(({ y2 }) => y2 === 1)).toBe(true);
  });

  it('keeps a long jump within the step limit and drops repeated spots', () => {
    const long = trailPoints([{ from: at(-500, 0), to: at(500, 0) }], 2);
    const still = trailPoints([{ from: at(4, 4), to: at(4, 4) }], 6);

    expect(long.length).toBeLessThanOrEqual(FOG_MEMORY.maxPointsPerStep + 1);
    expect(still).toEqual([{ x2: 9, y2: 9 }]);
  });

  it('sends the points as a flat list', () => {
    expect(
      flatten([
        { x2: 1, y2: 2 },
        { x2: 3, y2: 4 },
      ]),
    ).toEqual([1, 2, 3, 4]);
  });
});
