import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './application/ports/password-hasher';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case';
import { ProvisionUserUseCase } from './application/use-cases/provision-user.use-case';
import { VerifyCredentialsUseCase } from './application/use-cases/verify-credentials.use-case';
import { UserRepository } from './domain/repositories/user.repository';
import { Argon2PasswordHasher } from './infrastructure/crypto/argon2-password-hasher';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/entities/user.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    VerifyCredentialsUseCase,
    GetUserByIdUseCase,
    ProvisionUserUseCase,
  ],
  exports: [VerifyCredentialsUseCase, GetUserByIdUseCase, ProvisionUserUseCase],
})
export class UsersModule {}
