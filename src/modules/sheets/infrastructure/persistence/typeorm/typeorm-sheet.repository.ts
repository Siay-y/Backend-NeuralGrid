import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CharacterSheet } from '../../../domain/entities/character-sheet';
import { SheetRepository } from '../../../domain/repositories/sheet.repository';
import {
  normalizeSheetData,
  type SheetData,
} from '../../../domain/value-objects/sheet-data';
import { SheetOrmEntity } from './sheet.orm-entity';

function readData(row: SheetOrmEntity): SheetData {
  try {
    return normalizeSheetData(row.data);
  } catch {
    return normalizeSheetData({ identity: { name: row.name } });
  }
}

function toDomain(row: SheetOrmEntity): CharacterSheet {
  return CharacterSheet.restore({
    id: row.id,
    ownerId: row.ownerId,
    kind: row.kind,
    data: readData(row),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toOrm(sheet: CharacterSheet): SheetOrmEntity {
  const row = new SheetOrmEntity();
  row.id = sheet.id;
  row.ownerId = sheet.ownerId;
  row.kind = sheet.kind;
  row.name = sheet.name;
  row.data = sheet.data;
  row.version = sheet.version;
  row.createdAt = sheet.createdAt;
  row.updatedAt = sheet.updatedAt;
  return row;
}

@Injectable()
export class TypeOrmSheetRepository extends SheetRepository {
  constructor(
    @InjectRepository(SheetOrmEntity)
    private readonly rows: Repository<SheetOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<CharacterSheet[]> {
    const rows = await this.rows.find({ order: { createdAt: 'ASC' } });
    return rows.map(toDomain);
  }

  async findByOwner(ownerId: string): Promise<CharacterSheet[]> {
    const rows = await this.rows.find({
      where: { ownerId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<CharacterSheet | null> {
    const row = await this.rows.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  count(): Promise<number> {
    return this.rows.count();
  }

  countByOwner(ownerId: string): Promise<number> {
    return this.rows.countBy({ ownerId });
  }

  async save(sheet: CharacterSheet): Promise<void> {
    await this.rows.save(toOrm(sheet));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.rows.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
