import { PresenceTracker } from './presence-tracker';

describe('PresenceTracker', () => {
  it('reports a user online once, even with several tabs', () => {
    const presence = new PresenceTracker();

    expect(presence.join('ana', 's1')).toBe(true);
    expect(presence.join('ana', 's2')).toBe(false);
    expect(presence.onlineUserIds()).toEqual(['ana']);
  });

  it('reports a user offline only when the last tab closes', () => {
    const presence = new PresenceTracker();
    presence.join('ana', 's1');
    presence.join('ana', 's2');

    expect(presence.leave('ana', 's1')).toBe(false);
    expect(presence.leave('ana', 's2')).toBe(true);
    expect(presence.onlineUserIds()).toEqual([]);
  });

  it('counts the open connections of each user', () => {
    const presence = new PresenceTracker();
    presence.join('ana', 's1');
    presence.join('ana', 's2');
    presence.join('mestre', 's3');

    expect(presence.connectionCount('ana')).toBe(2);
    expect(presence.connectionCount('mestre')).toBe(1);
    expect(presence.connectionCount('ninguem')).toBe(0);
  });

  it('ignores sockets it never saw', () => {
    const presence = new PresenceTracker();

    expect(presence.leave('ana', 'ghost')).toBe(false);
  });
});
