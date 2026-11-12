import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapEvents } from './application/services/map-events';
import { MapImageCache } from './application/services/map-image-cache';
import {
  ActivateMapUseCase,
  AddMapAreaUseCase,
  DeleteMapAreaUseCase,
  DeleteMapUseCase,
  GetSceneUseCase,
  ListMapsUseCase,
  ReadMapImageUseCase,
  RenameMapUseCase,
  UpdateMapAreaUseCase,
  UploadMapUseCase,
} from './application/use-cases/map-use-cases';
import {
  ExploreFogUseCase,
  ForgetFogUseCase,
  GetFogMemoryUseCase,
  GetFogUseCase,
  UpdateFogUseCase,
} from './application/use-cases/fog-use-cases';
import { FogMemoryRepository } from './domain/repositories/fog-memory.repository';
import { FogExploredOrmEntity } from './infrastructure/persistence/typeorm/fog-explored.orm-entity';
import { TypeOrmFogMemoryRepository } from './infrastructure/persistence/typeorm/typeorm-fog-memory.repository';
import { FogSettingsRepository } from './domain/repositories/fog-settings.repository';
import { MapRepository } from './domain/repositories/map.repository';
import { MapAreaOrmEntity } from './infrastructure/persistence/typeorm/map-area.orm-entity';
import { MapOrmEntity } from './infrastructure/persistence/typeorm/map.orm-entity';
import { TableSettingsOrmEntity } from './infrastructure/persistence/typeorm/table-settings.orm-entity';
import { TypeOrmFogSettingsRepository } from './infrastructure/persistence/typeorm/typeorm-fog-settings.repository';
import { TypeOrmMapRepository } from './infrastructure/persistence/typeorm/typeorm-map.repository';
import { MapsController } from './presentation/http/maps.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MapOrmEntity,
      MapAreaOrmEntity,
      TableSettingsOrmEntity,
      FogExploredOrmEntity,
    ]),
  ],
  controllers: [MapsController],
  providers: [
    { provide: MapRepository, useClass: TypeOrmMapRepository },
    { provide: FogSettingsRepository, useClass: TypeOrmFogSettingsRepository },
    { provide: FogMemoryRepository, useClass: TypeOrmFogMemoryRepository },
    GetFogUseCase,
    UpdateFogUseCase,
    GetFogMemoryUseCase,
    ExploreFogUseCase,
    ForgetFogUseCase,
    MapEvents,
    MapImageCache,
    ListMapsUseCase,
    GetSceneUseCase,
    UploadMapUseCase,
    AddMapAreaUseCase,
    RenameMapUseCase,
    UpdateMapAreaUseCase,
    ActivateMapUseCase,
    DeleteMapUseCase,
    DeleteMapAreaUseCase,
    ReadMapImageUseCase,
  ],
  exports: [
    GetFogUseCase,
    UpdateFogUseCase,
    GetFogMemoryUseCase,
    ExploreFogUseCase,
    ForgetFogUseCase,
    MapEvents,
    ListMapsUseCase,
    GetSceneUseCase,
    RenameMapUseCase,
    UpdateMapAreaUseCase,
    ActivateMapUseCase,
    DeleteMapUseCase,
    DeleteMapAreaUseCase,
  ],
})
export class MapsModule {}
