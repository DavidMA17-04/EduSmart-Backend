import { NotFoundException } from '@nestjs/common';
import { CommunicationStatus } from '../entities/communication.entity';
import { ReadingConfirmationService } from './reading-confirmation.service';

describe('ReadingConfirmationService — alcance por destinatario', () => {
  const date = new Date('2026-10-29T12:34:56Z');
  const actor = { id: 7, roles: ['Encargado'], permissions: ['communications.view'] } as any;
  const setup = (visible = true, status = CommunicationStatus.PUBLISHED) => {
    const reads = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn(x => x), save: jest.fn(async x => x) };
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 'comm', authorId: 99, status }),
      isFeedVisible: jest.fn().mockResolvedValue(visible),
    };
    const targeting = { getUserTargetContext: jest.fn().mockResolvedValue({ roleNames: ['Encargado'], groupIds: [10] }) };
    return { reads, repository, service: new ReadingConfirmationService(reads as any, repository as any, targeting as any) };
  };

  it.each(['markAsRead', 'confirmRead'] as const)('rechaza %s de un id fuera de audiencia sin escribir', async method => {
    const { service, reads, repository } = setup(false);
    await expect(service[method]('comm', actor)).rejects.toThrow(NotFoundException);
    expect(repository.isFeedVisible).toHaveBeenCalledWith('comm', { userId: 7, roleNames: ['Encargado'], groupIds: [10] });
    expect(reads.findOne).not.toHaveBeenCalled();
    expect(reads.save).not.toHaveBeenCalled();
  });

  it.each([
    ['Director por rol institucional', { id: 8, roles: ['Director'], permissions: ['communications.view'] } as any],
    ['gestor por permiso', { id: 8, roles: ['Docente'], permissions: ['communications.manage'] } as any],
  ])('%s lee un publicado fuera de su audiencia, con el mismo criterio que el detalle', async (_label, manager) => {
    const { service, reads, repository } = setup(false);
    await service.markAsRead('comm', manager);
    expect(repository.isFeedVisible).not.toHaveBeenCalled();
    expect(reads.save).toHaveBeenCalledWith(expect.objectContaining({ communicationId: 'comm', userId: 8 }));
  });

  it('usa los roles de la sesión para calcular la audiencia', async () => {
    const { service } = setup();
    const targeting = (service as any).targeting;
    await service.markAsRead('comm', actor);
    expect(targeting.getUserTargetContext).toHaveBeenCalledWith(7, ['Encargado']);
  });

  it('un borrador no admite lecturas directas', async () => {
    const { service, reads } = setup(true, CommunicationStatus.DRAFT);
    await expect(service.markAsRead('comm', actor)).rejects.toThrow(NotFoundException);
    expect(reads.save).not.toHaveBeenCalled();
  });

  it('registra una lectura para el destinatario autorizado', async () => {
    const { service, reads } = setup();
    await service.markAsRead('comm', actor);
    expect(reads.save).toHaveBeenCalledWith(expect.objectContaining({ communicationId: 'comm', userId: 7 }));
  });

  it('conserva la primera fecha de acuse al confirmar otra vez', async () => {
    const { service, reads } = setup();
    const read = { communicationId: 'comm', userId: 7, readAt: date, acknowledgedAt: date };
    reads.findOne.mockResolvedValue(read);
    expect((await service.confirmRead('comm', actor)).acknowledgedAt).toEqual(date);
    expect((await service.confirmRead('comm', actor)).acknowledgedAt).toEqual(date);
  });
});
