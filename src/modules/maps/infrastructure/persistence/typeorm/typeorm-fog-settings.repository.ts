import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FogSettingsRepository } from '../../../domain/repositories/fog-settings.repository';
import {
  DEFAULT_FOG,
  type FogSettings,
} from '../../../domain/value-objects/fog-settings';
import { TableSettingsOrmEntity } from './table-settings.orm-entity';

const SETTINGS_ID = 1;

@Injectable()
export class TypeOrmFogSettingsRepository extends FogSettingsRepository {
  constructor(
    @InjectRepository(TableSettingsOrmEntity)
    private readonly rows: Repository<TableSettingsOrmEntity>,
  ) {
    super();
  }

  async get(): Promise<FogSettings> {
    const row = await this.rows.findOneBy({ id: SETTINGS_ID });
    return row
      ? { enabled: row.fogEnabled, radius: row.lightRadius }
      : { ...DEFAULT_FOG };
  }

  async save(fog: FogSettings): Promise<void> {
    await this.rows.upsert(
      { id: SETTINGS_ID, fogEnabled: fog.enabled, lightRadius: fog.radius },
      ['id'],
    );
  }
}
