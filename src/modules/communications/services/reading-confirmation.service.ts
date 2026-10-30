import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationRead } from '../entities/communication-read.entity';
import { CommunicationsRepository } from '../repositories/communications.repository';
import { CommunicationTargetingService } from './communication-targeting.service';
import { CommunicationStatus } from '../entities/communication.entity';

@Injectable()
export class ReadingConfirmationService {
  constructor(
    @InjectRepository(CommunicationRead)
    private readonly readRepo: Repository<CommunicationRead>,
    private readonly repository: CommunicationsRepository,
    private readonly targeting: CommunicationTargetingService,
  ) {}

  private async assertReadable(communicationId: string, userId: number) {
    const comm = await this.repository.findById(communicationId);
    if (!comm || comm.status !== CommunicationStatus.PUBLISHED) {
      throw new NotFoundException('Comunicado no encontrado');
    }
    const context = await this.targeting.getUserTargetContext(userId, []);
    if (comm.authorId !== userId && !(await this.repository.userCanManage(userId)) &&
      !(await this.repository.isFeedVisible(communicationId, { userId, ...context }))) {
      throw new NotFoundException('Comunicado no encontrado');
    }
  }

  async markAsRead(communicationId: string, userId: number): Promise<CommunicationRead> {
    await this.assertReadable(communicationId, userId);

    let read = await this.readRepo.findOne({
      where: { communicationId, userId },
    });

    if (!read) {
      read = this.readRepo.create({
        communicationId,
        userId,
        readAt: new Date(Math.floor(Date.now() / 1000) * 1000),
        acknowledgedAt: null,
      });
      read = await this.readRepo.save(read);
    }

    return read;
  }

  async confirmRead(communicationId: string, userId: number): Promise<CommunicationRead> {
    await this.assertReadable(communicationId, userId);

    let read = await this.readRepo.findOne({
      where: { communicationId, userId },
    });

    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    if (!read) {
      read = this.readRepo.create({
        communicationId,
        userId,
        readAt: now,
        acknowledgedAt: now,
      });
    } else {
      read.acknowledgedAt ??= now;
    }

    return this.readRepo.save(read);
  }

  async getStats(communicationId: string) {
    const stats = await this.repository.getDetailedStats(communicationId);
    if (!stats) {
      throw new NotFoundException('Comunicado no encontrado');
    }
    return stats;
  }
}
