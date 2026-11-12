import type { UserRole } from '../../../users/domain/value-objects/user-role';
import type { BattleMap } from '../entities/battle-map';
import type { MapArea } from '../entities/map-area';
import { MapForbiddenError } from '../errors/map-forbidden.error';
import type { MapImageKind } from '../repositories/map.repository';

export interface MapActor {
  id: string;
  role: UserRole;
}

export const MapPolicy = {
  assertCanManage(actor: MapActor): void {
    if (actor.role !== 'master') {
      throw new MapForbiddenError();
    }
  },

  // Players only ever receive the visible areas of the map on the table. The
  // library, thumbnails, hidden areas and maps prepared for later scenes stay
  // with the master, so nothing can be spoiled by guessing an id.
  canSee(
    actor: MapActor,
    map: BattleMap,
    area: MapArea,
    kind: MapImageKind,
  ): boolean {
    return (
      actor.role === 'master' ||
      (kind === 'image' && map.active && !area.hidden)
    );
  },
};
