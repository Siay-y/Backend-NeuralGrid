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
import { MapRepository } from './domain/repositories/map.repository';
import { MapAreaOrmEntity } from './infrastructure/persistence/typeorm/map-area.orm-entity';
import { MapOrmEntity } from './infrastructure/persistence/typeorm/map.orm-entity';
import { TypeOrmMapRepository } from './infrastructure/persistence/typeorm/typeorm-map.repository';
import { MapsController } from './presentation/http/maps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MapOrmEntity, MapAreaOrmEntity])],
  controllers: [MapsController],
  providers: [
    { provide: MapRepository, useClass: TypeOrmMapRepository },
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
