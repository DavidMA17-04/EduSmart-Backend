import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Communication } from './entities/communication.entity';
import { CommunicationRecipient } from './entities/communication-recipient.entity';
import { CommunicationRead } from './entities/communication-read.entity';
import { CommunicationsController } from './controllers/communications.controller';
import { CommunicationsService } from './services/communications.service';
import { CommunicationTargetingService } from './services/communication-targeting.service';
import { ReadingConfirmationService } from './services/reading-confirmation.service';
import { CommunicationsRepository } from './repositories/communications.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Communication, CommunicationRecipient, CommunicationRead])],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    CommunicationTargetingService,
    ReadingConfirmationService,
    CommunicationsRepository,
  ],
  exports: [CommunicationsService, CommunicationTargetingService, ReadingConfirmationService],
})
export class CommunicationsModule {}
