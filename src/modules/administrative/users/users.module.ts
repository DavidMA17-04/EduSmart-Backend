import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersBootstrapService } from './services/users-bootstrap.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersBootstrapService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
