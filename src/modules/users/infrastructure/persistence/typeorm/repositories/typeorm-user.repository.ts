import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { User } from '../../../../domain/entities/user';
import { UserRepository } from '../../../../domain/repositories/user.repository';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly rows: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.rows.findOneBy({ id });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.rows.findOneBy({ username });
    return row ? UserMapper.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.rows.save(UserMapper.toOrm(user));
  }
}
