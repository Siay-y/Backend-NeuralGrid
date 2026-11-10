import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { toUserView, UserView } from '../dtos/user-view';

@Injectable()
export class GetUserByIdUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserView | null> {
    const user = await this.users.findById(id);
    return user ? toUserView(user) : null;
  }
}
