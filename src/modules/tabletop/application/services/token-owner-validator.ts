import { Injectable } from '@nestjs/common';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { InvalidTokenError } from '../../domain/errors/invalid-token.error';

@Injectable()
export class TokenOwnerValidator {
  constructor(private readonly getUserById: GetUserByIdUseCase) {}

  async assertValid(ownerId: string | null): Promise<void> {
    if (ownerId === null) {
      return;
    }
    const owner = await this.getUserById.execute(ownerId);
    if (!owner) {
      throw new InvalidTokenError('O dono escolhido não faz parte da mesa');
    }
  }
}
