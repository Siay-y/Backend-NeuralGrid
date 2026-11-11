import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Token } from '../../../../domain/entities/token';
import { TokenRepository } from '../../../../domain/repositories/token.repository';
import { TokenOrmEntity } from '../entities/token.orm-entity';
import { TokenMapper } from '../mappers/token.mapper';

@Injectable()
export class TypeOrmTokenRepository extends TokenRepository {
  constructor(
    @InjectRepository(TokenOrmEntity)
    private readonly rows: Repository<TokenOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<Token[]> {
    const rows = await this.rows.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => TokenMapper.toDomain(row));
  }

  async findById(id: string): Promise<Token | null> {
    const row = await this.rows.findOneBy({ id });
    return row ? TokenMapper.toDomain(row) : null;
  }

  async findBySheet(sheetId: string): Promise<Token[]> {
    const rows = await this.rows.findBy({ sheetId });
    return rows.map((row) => TokenMapper.toDomain(row));
  }

  async save(token: Token): Promise<void> {
    await this.rows.save(TokenMapper.toOrm(token));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.rows.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
