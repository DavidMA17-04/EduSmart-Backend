import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import {
  Communication,
  CommunicationPriority,
  CommunicationStatus,
} from '../entities/communication.entity';
import { RecipientType } from '../entities/communication-recipient.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Role } from '../../../common/enums/role.enum';

describe('CommunicationsService', () => {
  let service: CommunicationsService;
  let mockRepo: any;
  let mockTargeting: any;
  let mockReading: any;

  const mockUser: AuthenticatedUser = {
    id: 10,
    email: 'docente@ctphojancha.ed.cr',
    roles: [Role.TEACHER],
    permissions: ['communications.view', 'communications.create'],
    mustChangePassword: false,
  };

  const adminUser: AuthenticatedUser = {
    id: 1,
    email: 'admin@ctphojancha.ed.cr',
    roles: [Role.ADMIN],
    permissions: ['communications.view', 'communications.create', 'communications.manage'],
    mustChangePassword: false,
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'comm-123', ...data })),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((comm) => Promise.resolve(comm)),
      delete: jest.fn().mockResolvedValue(undefined),
      findFeedForUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findAdminList: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      attachGroupLabels: jest.fn().mockImplementation((views) => Promise.resolve(views)),
    };

    mockTargeting = {
      setTargets: jest.fn().mockResolvedValue(undefined),
      getUserTargetContext: jest.fn().mockResolvedValue({
        roleNames: ['Docente', 'TEACHER'],
        groupIds: [101, 102],
      }),
      getTargetOptions: jest.fn().mockResolvedValue({ roles: [], groups: [] }),
    };

    mockReading = {
      markAsRead: jest.fn().mockResolvedValue({ readAt: new Date() }),
      confirmRead: jest.fn().mockResolvedValue({ acknowledgedAt: new Date() }),
      getStats: jest.fn().mockResolvedValue({ totalReads: 5, readRate: 50 }),
    };

    service = new CommunicationsService(mockRepo, mockTargeting, mockReading);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a draft communication with default ALL recipient when none provided', async () => {
      const commData = {
        title: 'Reunión de personal',
        content: 'Estimados docentes...',
        priority: CommunicationPriority.IMPORTANT,
      };

      mockRepo.findById.mockResolvedValueOnce({
        id: 'comm-123',
        ...commData,
        status: CommunicationStatus.DRAFT,
        authorId: mockUser.id,
      });

      const result = await service.create(commData as any, mockUser.id);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reunión de personal',
          authorId: mockUser.id,
          status: CommunicationStatus.DRAFT,
        }),
      );
      expect(mockTargeting.setTargets).toHaveBeenCalledWith('comm-123', [
        { recipientType: RecipientType.ALL },
      ]);
      expect(result.id).toBe('comm-123');
    });

    it('sets publishDate when creating directly as PUBLISHED', async () => {
      const commData = {
        title: 'Aviso urgente',
        content: 'Suspensión de lecciones por rayería',
        status: CommunicationStatus.PUBLISHED,
        priority: CommunicationPriority.URGENT,
      };

      mockRepo.findById.mockResolvedValueOnce({ id: 'comm-urg', ...commData });

      await service.create(commData as any, mockUser.id);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CommunicationStatus.PUBLISHED,
          publishDate: expect.any(Date),
        }),
      );
    });
  });

  describe('findFeed', () => {
    it('resolves user targets and queries repository with user group context', async () => {
      await service.findFeed({}, mockUser);

      expect(mockTargeting.getUserTargetContext).toHaveBeenCalledWith(mockUser.id, mockUser.roles);
      expect(mockRepo.findFeedForUser).toHaveBeenCalledWith(
        { userId: mockUser.id, roleNames: ['Docente', 'TEACHER'], groupIds: [101, 102] },
        {},
      );
    });
  });

  describe('update & authorization', () => {
    it('allows author to update their own communication', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        authorId: mockUser.id,
        title: 'Original Title',
      });

      const updated = await service.update(
        'comm-123',
        { title: 'New Title' },
        mockUser,
      );

      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException if non-author without manage permission attempts update', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        authorId: 999, // different author
        title: 'Other Title',
      });

      await expect(
        service.update('comm-123', { title: 'Hacked' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin to update any communication', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        authorId: 999,
        title: 'Other Title',
      });

      await service.update('comm-123', { title: 'Admin Update' }, adminUser);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('publish & archive', () => {
    it('publish sets status to PUBLISHED', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        authorId: mockUser.id,
        status: CommunicationStatus.DRAFT,
      });

      await service.publish('comm-123', mockUser);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CommunicationStatus.PUBLISHED,
          publishDate: expect.any(Date),
        }),
      );
    });

    it('archive sets status to ARCHIVED', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        authorId: mockUser.id,
        status: CommunicationStatus.PUBLISHED,
      });

      await service.archive('comm-123', mockUser);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CommunicationStatus.ARCHIVED,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if communication does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('marks as read when a published communication is viewed', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        status: CommunicationStatus.PUBLISHED,
        authorId: 99,
      });
      const result = await service.findOne('comm-123', mockUser);

      expect(mockReading.markAsRead).toHaveBeenCalledWith('comm-123', mockUser.id);
      expect(result.isRead).toBe(true);
    });

    it('does not register reads on drafts and hides them from non-authors', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        status: CommunicationStatus.DRAFT,
        authorId: 99,
      });
      await expect(service.findOne('comm-123', mockUser)).rejects.toThrow(NotFoundException);
      expect(mockReading.markAsRead).not.toHaveBeenCalled();
    });

    it('never exposes the author password hash', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'comm-123',
        status: CommunicationStatus.PUBLISHED,
        authorId: 99,
        author: {
          id: 99,
          name: 'Ana',
          first_lastname: 'Solís',
          email: 'ana@ctphojancha.ed.cr',
          password_hash: '$2b$10$secret',
        },
        recipients: [],
      });
      const result = await service.findOne('comm-123', mockUser);

      expect(JSON.stringify(result)).not.toContain('password_hash');
      expect(result.authorName).toBe('Ana Solís');
    });
  });

  describe('recipients validation', () => {
    it('rejects role/group targeting without any target', async () => {
      await expect(
        service.create(
          {
            title: 'Aviso',
            content: 'Contenido del aviso',
            recipients: [{ recipientType: RecipientType.ROLE }],
          },
          mockUser.id,
        ),
      ).rejects.toThrow('Seleccione al menos un destinatario');
    });

    it('rejects an expiration date before the publish date', async () => {
      await expect(
        service.create(
          {
            title: 'Aviso',
            content: 'Contenido del aviso',
            status: CommunicationStatus.PUBLISHED,
            expirationDate: '2020-01-01T00:00:00Z',
          },
          mockUser.id,
        ),
      ).rejects.toThrow('vigencia');
    });
  });
});
