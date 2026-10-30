import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationRead } from '../entities/communication-read.entity';
import { CommunicationsRepository } from '../repositories/communications.repository';
import { CommunicationTargetingService } from './communication-targeting.service';
import { CommunicationStatus } from '../entities/communication.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { canManageCommunications } from '../utils/communication-access.util';

type CommunicationActor = Pick<AuthenticatedUser, 'id' | 'roles' | 'permissions'>;

@Injectable()
export class ReadingConfirmationService {
  constructor(
    @InjectRepository(CommunicationRead)
    private readonly readRepo: Repository<CommunicationRead>,
    private readonly repository: CommunicationsRepository,
    private readonly targeting: CommunicationTargetingService,
  ) {}

  /** Same audience as the feed; authors and managers may read any published item. */
  private async assertReadable(communicationId: string, actor: CommunicationActor) {
    const comm = await this.repository.findById(communicationId);
    if (!comm || comm.status !== CommunicationStatus.PUBLISHED) {
      throw new NotFoundException('Comunicado no encontrado');
    }
    if (comm.authorId === actor.id || canManageCommunications(actor)) return;
    const context = await this.targeting.getUserTargetContext(actor.id, actor.roles);
    if (!(await this.repository.isFeedVisible(communicationId, { userId: actor.id, ...context }))) {
      throw new NotFoundException('Comunicado no encontrado');
    }
  }

  async markAsRead(communicationId: string, actor: CommunicationActor): Promise<CommunicationRead> {
    await this.assertReadable(communicationId, actor);
    const userId = actor.id;

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

  async confirmRead(communicationId: string, actor: CommunicationActor): Promise<CommunicationRead> {
    await this.assertReadable(communicationId, actor);
    const userId = actor.id;

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
