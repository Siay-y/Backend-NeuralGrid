import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { CharacterSheet } from '../../domain/entities/character-sheet';
import { InvalidSheetError } from '../../domain/errors/invalid-sheet.error';
import { SheetLimitError } from '../../domain/errors/sheet-limit.error';
import { SheetNotFoundError } from '../../domain/errors/sheet-not-found.error';
import {
  type SheetActor,
  SheetPolicy,
} from '../../domain/policies/sheet-policy';
import { SheetRepository } from '../../domain/repositories/sheet.repository';
import type { SheetKind } from '../../domain/value-objects/sheet-data';
import {
  sameIdentity,
  type SheetChange,
  type SheetView,
  toSheetView,
} from '../dtos/sheet-view';

export const SHEETS_PER_PLAYER = 5;
export const SHEETS_PER_TABLE = 200;

export interface CreateSheetInput {
  kind?: SheetKind;
  ownerId?: string | null;
  data: unknown;
}

export interface UpdateSheetInput {
  id: string;
  kind?: SheetKind;
  ownerId?: string | null;
  data?: unknown;
}

export interface SheetRemoval {
  id: string;
  ownerId: string | null;
}

@Injectable()
export class SheetOwnerValidator {
  constructor(private readonly getUserById: GetUserByIdUseCase) {}

  async assertValid(ownerId: string | null): Promise<void> {
    if (ownerId !== null && !(await this.getUserById.execute(ownerId))) {
      throw new InvalidSheetError('O dono escolhido não faz parte da mesa');
    }
  }
}

@Injectable()
export class ListSheetsUseCase {
  constructor(private readonly sheets: SheetRepository) {}

  async execute(actor: SheetActor): Promise<SheetView[]> {
    const sheets =
      actor.role === 'master'
        ? await this.sheets.findAll()
        : await this.sheets.findByOwner(actor.id);
    return sheets.map(toSheetView);
  }
}

@Injectable()
export class CreateSheetUseCase {
  constructor(
    private readonly sheets: SheetRepository,
    private readonly owners: SheetOwnerValidator,
  ) {}

  async execute(
    actor: SheetActor,
    input: CreateSheetInput,
  ): Promise<SheetView> {
    const isMaster = SheetPolicy.canAssign(actor);
    if (
      !isMaster &&
      (input.kind !== undefined || input.ownerId !== undefined)
    ) {
      SheetPolicy.assertCanAssign(actor);
    }
    const ownerId = isMaster ? (input.ownerId ?? null) : actor.id;
    await this.owners.assertValid(ownerId);

    const sheet = CharacterSheet.create({
      id: randomUUID(),
      ownerId,
      kind: isMaster ? (input.kind ?? 'agent') : 'agent',
      data: input.data,
      now: new Date(),
    });

    if (
      !isMaster &&
      (await this.sheets.countByOwner(actor.id)) >= SHEETS_PER_PLAYER
    ) {
      throw new SheetLimitError(
        `Cada jogador pode ter até ${SHEETS_PER_PLAYER} fichas`,
      );
    }
    if ((await this.sheets.count()) >= SHEETS_PER_TABLE) {
      throw new SheetLimitError(
        `A mesa chegou a ${SHEETS_PER_TABLE} fichas. Apague algumas antes`,
      );
    }

    await this.sheets.save(sheet);
    return toSheetView(sheet);
  }
}

@Injectable()
export class UpdateSheetUseCase {
  constructor(
    private readonly sheets: SheetRepository,
    private readonly owners: SheetOwnerValidator,
  ) {}

  async execute(
    actor: SheetActor,
    input: UpdateSheetInput,
  ): Promise<SheetChange> {
    const sheet = await this.sheets.findById(input.id);
    if (!sheet || !SheetPolicy.canEdit(actor, sheet)) {
      throw new SheetNotFoundError();
    }
    if (input.kind !== undefined || input.ownerId !== undefined) {
      SheetPolicy.assertCanAssign(actor);
    }
    if (input.ownerId !== undefined && input.ownerId !== sheet.ownerId) {
      await this.owners.assertValid(input.ownerId);
    }

    const updated = sheet.edit(
      { data: input.data, kind: input.kind, ownerId: input.ownerId },
      new Date(),
    );
    await this.sheets.save(updated);
    const view = toSheetView(updated);
    return {
      sheet: view,
      previousOwnerId: sheet.ownerId,
      identityChanged: !sameIdentity(toSheetView(sheet), view),
    };
  }
}

@Injectable()
export class DeleteSheetUseCase {
  constructor(private readonly sheets: SheetRepository) {}

  async execute(actor: SheetActor, id: string): Promise<SheetRemoval> {
    const sheet = await this.sheets.findById(id);
    if (!sheet || !SheetPolicy.canEdit(actor, sheet)) {
      throw new SheetNotFoundError();
    }
    await this.sheets.delete(id);
    return { id, ownerId: sheet.ownerId };
  }
}

@Injectable()
export class FindSheetUseCase {
  constructor(private readonly sheets: SheetRepository) {}

  async execute(id: string): Promise<SheetView | null> {
    const sheet = await this.sheets.findById(id);
    return sheet ? toSheetView(sheet) : null;
  }
}
