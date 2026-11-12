import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FogMemoryRepository } from '../../../domain/repositories/fog-memory.repository';
import type { ExploredPoint } from '../../../domain/value-objects/fog-memory';
import { FogExploredOrmEntity } from './fog-explored.orm-entity';

@Injectable()
export class TypeOrmFogMemoryRepository extends FogMemoryRepository {
  constructor(
    @InjectRepository(FogExploredOrmEntity)
    private readonly rows: Repository<FogExploredOrmEntity>,
  ) {
    super();
  }

  async list(mapId: string): Promise<ExploredPoint[]> {
    const rows = await this.rows.find({
      where: { mapId },
      select: { x2: true, y2: true },
    });
    return rows.map(({ x2, y2 }) => ({ x2, y2 }));
  }

  count(mapId: string): Promise<number> {
    return this.rows.countBy({ mapId });
  }

  async add(
    mapId: string,
    points: readonly ExploredPoint[],
  ): Promise<ExploredPoint[]> {
    if (points.length === 0) {
      return [];
    }
    const result = await this.rows
      .createQueryBuilder()
      .insert()
      .values(points.map(({ x2, y2 }) => ({ mapId, x2, y2 })))
      .orIgnore()
      .returning(['x2', 'y2'])
      .execute();
    return (result.raw as ExploredPoint[]).map(({ x2, y2 }) => ({ x2, y2 }));
  }

  async clear(mapId: string): Promise<void> {
    await this.rows.delete({ mapId });
  }
}
