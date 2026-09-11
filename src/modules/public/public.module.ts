import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { SpecialtyEntity } from '../administrative/specialties/entities/specialty.entity';
import { User } from '../administrative/users/entities/user.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, SpecialtyEntity, SectionEntity])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
