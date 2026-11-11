import { InvalidSheetError } from '../errors/invalid-sheet.error';
import { mergeSheetData, normalizeSheetData, SKILLS } from './sheet-data';

describe('sheet data', () => {
  it('fills a new sheet with sensible defaults', () => {
    const data = normalizeSheetData({ identity: { name: '  Kian  ' } });

    expect(data.identity).toEqual({
      name: 'Kian',
      codename: '',
      age: null,
      sex: null,
      className: '',
    });
    expect(data.attributes).toEqual({
      strength: 10,
      agility: 10,
      resistance: 10,
      perception: 10,
      intelligence: 10,
      charisma: 10,
      luck: 10,
    });
    expect(data.status).toEqual({
      hp: { current: 10, max: 10 },
      xp: 0,
      movement: 9,
      money: 0,
      armor: 10,
      carry: 50,
    });
    expect(Object.keys(data.skills)).toHaveLength(SKILLS.length);
    expect(Object.values(data.skills).every((bonus) => bonus === 0)).toBe(true);
    expect(data.equipment).toEqual({ weapons: [], armors: [], items: [] });
  });

  it('drops fields it does not know, including ones from older sheets', () => {
    const data = normalizeSheetData({
      identity: { name: 'Kian', isAdmin: true, nex: 15 },
      status: { pv: { current: 3, max: 20 } },
      secret: 'x',
    });

    expect(data.identity).not.toHaveProperty('isAdmin');
    expect(data.identity).not.toHaveProperty('nex');
    expect(data.status).not.toHaveProperty('pv');
    expect(data).not.toHaveProperty('secret');
  });

  it('keeps weights to one decimal and weapons on a known attribute', () => {
    const data = normalizeSheetData({
      identity: { name: 'Kian' },
      equipment: {
        weapons: [{ id: 'w1', name: 'Espada', damage: '1d8+2', weight: 1.25 }],
        items: [{ id: 'i1', name: 'Corda', quantity: 2, weight: 0.5 }],
      },
    });

    expect(data.equipment.weapons[0]).toMatchObject({
      attribute: 'strength',
      bonus: 0,
      weight: 1.3,
    });
    expect(data.equipment.items[0].weight).toBe(0.5);
  });

  it('refuses values outside the rules of the game', () => {
    const named = { identity: { name: 'Kian' } };
    const cases = [
      { identity: { name: '' } },
      { ...named, attributes: { strength: 31 } },
      { ...named, skills: { arcana: 21 } },
      { ...named, status: { hp: { current: 1.5, max: 10 } } },
      { ...named, status: { armor: -1 } },
      { ...named, identity: { name: 'Kian', className: 'x'.repeat(65) } },
      {
        ...named,
        equipment: {
          weapons: [{ id: 'a', name: 'Faca', damage: 'drop table' }],
        },
      },
      {
        ...named,
        equipment: {
          weapons: [{ id: 'a', name: 'Faca', attribute: 'magic' }],
        },
      },
      {
        ...named,
        equipment: {
          items: [
            { id: 'a', name: 'Faca' },
            { id: 'a', name: 'Corda' },
          ],
        },
      },
      { ...named, equipment: { items: [{ id: 'a', weight: -2 }] } },
    ];

    for (const raw of cases) {
      expect(() => normalizeSheetData(raw)).toThrow(InvalidSheetError);
    }
  });

  it('replaces only the sections that changed', () => {
    const current = normalizeSheetData({
      identity: { name: 'Kian' },
      skills: { arcana: 3 },
    });

    const next = mergeSheetData(current, {
      status: { hp: { current: 7, max: 20 } },
    });

    expect(next.status.hp).toEqual({ current: 7, max: 20 });
    expect(next.status.armor).toBe(10);
    expect(next.skills.arcana).toBe(3);
    expect(next.identity).toBe(current.identity);
    expect(() => mergeSheetData(current, { inventory: [] })).toThrow(
      InvalidSheetError,
    );
  });
});
