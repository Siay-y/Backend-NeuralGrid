import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { toUserView, UserView } from '../dtos/user-view';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<UserView[]> {
    const users = await this.users.findAll();
    return users.map(toUserView);
  }
}
