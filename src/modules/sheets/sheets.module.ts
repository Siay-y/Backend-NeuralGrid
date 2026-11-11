import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import {
  CreateSheetUseCase,
  DeleteSheetUseCase,
  FindSheetUseCase,
  ListSheetsUseCase,
  SheetOwnerValidator,
  UpdateSheetUseCase,
} from './application/use-cases/sheet-use-cases';
import { SheetRepository } from './domain/repositories/sheet.repository';
import { SheetOrmEntity } from './infrastructure/persistence/typeorm/sheet.orm-entity';
import { TypeOrmSheetRepository } from './infrastructure/persistence/typeorm/typeorm-sheet.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SheetOrmEntity]), UsersModule],
  providers: [
    { provide: SheetRepository, useClass: TypeOrmSheetRepository },
    SheetOwnerValidator,
    ListSheetsUseCase,
    CreateSheetUseCase,
    UpdateSheetUseCase,
    DeleteSheetUseCase,
    FindSheetUseCase,
  ],
  exports: [
    ListSheetsUseCase,
    CreateSheetUseCase,
    UpdateSheetUseCase,
    DeleteSheetUseCase,
    FindSheetUseCase,
  ],
})
export class SheetsModule {}
