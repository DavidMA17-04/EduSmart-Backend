import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationRead } from '../entities/communication-read.entity';
import { CommunicationsRepository } from '../repositories/communications.repository';

@Injectable()
export class ReadingConfirmationService {
  constructor(
    @InjectRepository(CommunicationRead)
    private readonly readRepo: Repository<CommunicationRead>,
    private readonly repository: CommunicationsRepository,
  ) {}

  async markAsRead(communicationId: string, userId: number): Promise<CommunicationRead> {
    const comm = await this.repository.findById(communicationId);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    let read = await this.readRepo.findOne({
      where: { communicationId, userId },
    });

    if (!read) {
      read = this.readRepo.create({
        communicationId,
        userId,
        readAt: new Date(),
        acknowledgedAt: null,
      });
      read = await this.readRepo.save(read);
    }

    return read;
  }

  async confirmRead(communicationId: string, userId: number): Promise<CommunicationRead> {
    const comm = await this.repository.findById(communicationId);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    let read = await this.readRepo.findOne({
      where: { communicationId, userId },
    });

    const now = new Date();
    if (!read) {
      read = this.readRepo.create({
        communicationId,
        userId,
        readAt: now,
        acknowledgedAt: now,
      });
    } else {
      read.acknowledgedAt = now;
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
