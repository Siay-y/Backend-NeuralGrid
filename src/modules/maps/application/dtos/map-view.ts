import type { BattleMap } from '../../domain/entities/battle-map';
import type { MapArea } from '../../domain/entities/map-area';

export interface AreaView {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  col: number;
  row: number;
  cell: number;
  hidden: boolean;
}

export interface MapView {
  id: string;
  name: string;
  active: boolean;
  areas: AreaView[];
}

export interface SceneArea {
  id: string;
  width: number;
  height: number;
  col: number;
  row: number;
  cell: number;
  hidden?: boolean;
}

export interface SceneView {
  id: string;
  areas: SceneArea[];
}

export function toAreaView(area: MapArea): AreaView {
  return {
    id: area.id,
    name: area.name,
    width: area.width,
    height: area.height,
    bytes: area.byteSize,
    ...area.placement,
    hidden: area.hidden,
  };
}

export function toMapView(map: BattleMap, areas: readonly MapArea[]): MapView {
  return {
    id: map.id,
    name: map.name,
    active: map.active,
    areas: areas.map(toAreaView),
  };
}

export function toSceneView(map: MapView): SceneView {
  return {
    id: map.id,
    areas: map.areas.map((area) => ({
      id: area.id,
      width: area.width,
      height: area.height,
      col: area.col,
      row: area.row,
      cell: area.cell,
      hidden: area.hidden,
    })),
  };
}

// Players get the visible areas only, without names or the hidden flag.
export function toPlayerScene(scene: SceneView | null): SceneView | null {
  if (!scene) {
    return null;
  }
  return {
    id: scene.id,
    areas: scene.areas
      .filter((area) => !area.hidden)
      .map(({ id, width, height, col, row, cell }) => ({
        id,
        width,
        height,
        col,
        row,
        cell,
      })),
  };
}
