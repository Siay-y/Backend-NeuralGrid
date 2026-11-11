import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { Drawing } from '../../../../domain/entities/drawing';
import { DrawingRepository } from '../../../../domain/repositories/drawing.repository';
import { DrawingOrmEntity } from '../entities/drawing.orm-entity';
import { DrawingMapper } from '../mappers/drawing.mapper';

interface DeletedRow {
  id: string;
}

@Injectable()
export class TypeOrmDrawingRepository extends DrawingRepository {
  constructor(
    @InjectRepository(DrawingOrmEntity)
    private readonly rows: Repository<DrawingOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<Drawing[]> {
    const rows = await this.rows.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => DrawingMapper.toDomain(row));
  }

  async findByIds(ids: readonly string[]): Promise<Drawing[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.rows.findBy({ id: In([...ids]) });
    return rows.map((row) => DrawingMapper.toDomain(row));
  }

  count(): Promise<number> {
    return this.rows.count();
  }

  async save(drawing: Drawing): Promise<void> {
    await this.rows.save(DrawingMapper.toOrm(drawing));
  }

  async deleteByIds(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.deleted(
      await this.rows
        .createQueryBuilder()
        .delete()
        .where({ id: In([...ids]) })
        .returning('id')
        .execute(),
    );
  }

  async deleteByAuthor(authorId: string): Promise<string[]> {
    return this.deleted(
      await this.rows
        .createQueryBuilder()
        .delete()
        .where({ authorId })
        .returning('id')
        .execute(),
    );
  }

  async deleteAll(): Promise<string[]> {
    return this.deleted(
      await this.rows.createQueryBuilder().delete().returning('id').execute(),
    );
  }

  private deleted(result: { raw: unknown }): string[] {
    return (result.raw as DeletedRow[]).map((row) => row.id);
  }
}
