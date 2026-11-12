import { InvalidMapError } from '../errors/invalid-map.error';
import { MAP_LIMITS, type MapImageType } from '../value-objects/map-image';

export const DEFAULT_CELL_PIXELS = 70;

export interface MapPlacement {
  col: number;
  row: number;
  cell: number;
}

export interface MapAreaProps extends MapPlacement {
  id: string;
  mapId: string;
  name: string;
  type: MapImageType;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMapAreaProps extends MapPlacement {
  id: string;
  mapId: string;
  name: unknown;
  type: MapImageType;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  hidden: boolean;
  now: Date;
}

export interface MapAreaEdit {
  name?: unknown;
  col?: number;
  row?: number;
  cell?: number;
  hidden?: boolean;
}

export interface CellPoint {
  col: number;
  row: number;
}

export function normalizeAreaName(value: unknown): string {
  const name =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (name.length === 0) {
    throw new InvalidMapError('Dê um nome à área');
  }
  return name.slice(0, MAP_LIMITS.name);
}

function round(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

function checkedPosition(value: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAP_LIMITS.position) {
    throw new InvalidMapError(
      `A ${label} da área precisa ficar entre -${MAP_LIMITS.position} e ${MAP_LIMITS.position}`,
    );
  }
  return round(value);
}

function checkedCell(value: number): number {
  if (
    !Number.isFinite(value) ||
    value < MAP_LIMITS.cellMin ||
    value > MAP_LIMITS.cellMax
  ) {
    throw new InvalidMapError(
      `O quadrado da área precisa ter entre ${MAP_LIMITS.cellMin} e ${MAP_LIMITS.cellMax} pixels`,
    );
  }
  return round(value);
}

// Whole cells keep the image grid on the board grid when the image grid starts
// at its top left corner, which is how most battle maps are exported.
export function placeCenteredOn(
  center: CellPoint,
  size: { width: number; height: number },
  cell: number,
): MapPlacement {
  return {
    col: checkedPosition(
      Math.round(center.col - size.width / cell / 2),
      'coluna',
    ),
    row: checkedPosition(
      Math.round(center.row - size.height / cell / 2),
      'linha',
    ),
    cell,
  };
}

export function placeBeside(
  areas: readonly MapArea[],
  size: { width: number; height: number },
): MapPlacement {
  const last = areas.at(-1);
  if (!last) {
    return placeCenteredOn({ col: 0, row: 0 }, size, DEFAULT_CELL_PIXELS);
  }
  const right = Math.max(
    ...areas.map((area) => area.col + area.width / area.cell),
  );
  const top = Math.min(...areas.map((area) => area.row));
  return {
    col: checkedPosition(Math.ceil(right), 'coluna'),
    row: checkedPosition(Math.floor(top), 'linha'),
    cell: last.cell,
  };
}

export class MapArea {
  private constructor(private readonly props: Readonly<MapAreaProps>) {}

  static create(input: NewMapAreaProps): MapArea {
    return new MapArea({
      id: input.id,
      mapId: input.mapId,
      name: normalizeAreaName(input.name),
      type: input.type,
      width: input.width,
      height: input.height,
      byteSize: input.byteSize,
      checksum: input.checksum,
      col: checkedPosition(input.col, 'coluna'),
      row: checkedPosition(input.row, 'linha'),
      cell: checkedCell(input.cell),
      hidden: input.hidden,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: MapAreaProps): MapArea {
    return new MapArea({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get mapId(): string {
    return this.props.mapId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): MapImageType {
    return this.props.type;
  }

  get width(): number {
    return this.props.width;
  }

  get height(): number {
    return this.props.height;
  }

  get byteSize(): number {
    return this.props.byteSize;
  }

  get checksum(): string {
    return this.props.checksum;
  }

  get col(): number {
    return this.props.col;
  }

  get row(): number {
    return this.props.row;
  }

  get cell(): number {
    return this.props.cell;
  }

  get placement(): MapPlacement {
    return { col: this.props.col, row: this.props.row, cell: this.props.cell };
  }

  get hidden(): boolean {
    return this.props.hidden;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  edit(changes: MapAreaEdit, now: Date): MapArea {
    return new MapArea({
      ...this.props,
      name:
        changes.name === undefined
          ? this.props.name
          : normalizeAreaName(changes.name),
      col:
        changes.col === undefined
          ? this.props.col
          : checkedPosition(changes.col, 'coluna'),
      row:
        changes.row === undefined
          ? this.props.row
          : checkedPosition(changes.row, 'linha'),
      cell:
        changes.cell === undefined
          ? this.props.cell
          : checkedCell(changes.cell),
      hidden: changes.hidden ?? this.props.hidden,
      updatedAt: now,
    });
  }
}
