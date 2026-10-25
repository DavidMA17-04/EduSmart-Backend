import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { BulkImportService } from './bulk-import.service';
import { UserRoleEnum } from '../dto/bulk-import.dto';

describe('BulkImportService (PBI-05)', () => {
  let rolesRepository: { findAll: jest.Mock };
  let usersRepository: { findByNationalIdsOrEmails: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };
  let groupEnrollments: { enrollNewStudentsInTransaction: jest.Mock };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
  let activeGroups: Array<Record<string, unknown>>;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      create: jest.Mock;
      save: jest.Mock;
      getRepository: jest.Mock;
    };
  };
  let dataSource: { createQueryRunner: jest.Mock; getRepository: jest.Mock };
  let service: BulkImportService;
  let nextUserId: number;

  const studentRole = { id: 3, name: 'Estudiante' };
  const actor = {
    id: 1,
    email: 'admin@test.com',
    roles: [],
    permissions: [],
    mustChangePassword: false,
  };

  const record = (overrides: Record<string, unknown> = {}) => ({
    row: 1,
    national_id: '101110111',
    name: 'Ana',
    first_lastname: 'Pérez',
    second_lastname: 'Solís',
    email: 'ana@ctphojancha.ed.cr',
    phone: null,
    role: UserRoleEnum.ESTUDIANTE,
    section: null,
    user_status: UserStatus.ACTIVE,
    ...overrides,
  });

  const sampleRecords = [
    record(),
    record({
      row: 2,
      national_id: '202220222',
      name: 'Luis',
      first_lastname: 'Mora',
      second_lastname: null,
      email: 'luis@ctphojancha.ed.cr',
    }),
  ];

  beforeEach(() => {
    nextUserId = 1;
    activeGroups = [];
    rolesRepository = { findAll: jest.fn().mockResolvedValue([studentRole]) };
    usersRepository = { findByNationalIdsOrEmails: jest.fn().mockResolvedValue([]) };
    mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string) => (key === 'APP_PUBLIC_URL' ? 'http://localhost:5173' : undefined)),
    };
    groupEnrollments = { enrollNewStudentsInTransaction: jest.fn().mockResolvedValue([]) };
    auditRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn((_entity, data) => ({ ...data })),
        save: jest.fn(async (entity) => {
          if (entity && typeof entity === 'object' && 'national_id' in entity) {
            return { id: nextUserId++, ...entity };
          }
          return entity;
        }),
        getRepository: jest.fn(() => auditRepo),
      },
    };
    const groupsQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => activeGroups),
    };
    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
      getRepository: jest.fn(() => ({ createQueryBuilder: () => groupsQb })),
    };

    service = new BulkImportService(
      usersRepository as never,
      rolesRepository as never,
      dataSource as never,
      {} as never,
      mailService as never,
      configService as never,
      groupEnrollments as never,
    );
  });

  function group(id: number, name: string, max = 30) {
    return {
      id,
      name,
      maxCapacity: max,
      academicPeriodId: 7,
      academicPeriod: { name: 'Curso lectivo 2026', startDate: '2026-02-01' },
    };
  }

  it('generates unique temporary passwords (not the legacy shared secret)', () => {
    const a = service.generateTemporaryPassword();
    const b = service.generateTemporaryPassword();
    expect(a).not.toEqual(b);
    expect(a).not.toBe('EduSmart2026*');
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it('hashes per-user passwords and emails credentials after commit', async () => {
    const result = await service.executeBulkImport(sampleRecords as never, actor);

    expect(result.importedCount).toBe(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(mailService.sendMail).toHaveBeenCalledTimes(2);

    const savedUsers = queryRunner.manager.save.mock.calls
      .map((call) => call[0])
      .filter((row) => row && typeof row === 'object' && 'password_hash' in row);

    expect(savedUsers).toHaveLength(2);
    expect(savedUsers[0].password_hash).not.toEqual(savedUsers[1].password_hash);
    expect(savedUsers[0].mustChangePassword).toBe(true);

    const legacyHash = await bcrypt.hash('EduSmart2026*', 10);
    expect(savedUsers[0].password_hash).not.toEqual(legacyHash);

    const firstMail = mailService.sendMail.mock.calls[0][0];
    expect(firstMail.to).toBe('ana@ctphojancha.ed.cr');
    expect(firstMail.text).toMatch(/Contraseña temporal:/);
    expect(firstMail.html).toContain('/login');
  });

  it('does not send mail when the transaction rolls back', async () => {
    queryRunner.manager.save.mockRejectedValueOnce(new Error('db failure'));

    await expect(service.executeBulkImport(sampleRecords as never, actor)).rejects.toThrow();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('keeps imported users when SMTP fails after commit', async () => {
    mailService.sendMail.mockRejectedValue(new Error('smtp down'));

    const result = await service.executeBulkImport(sampleRecords as never, actor);

    expect(result.importedCount).toBe(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(mailService.sendMail).toHaveBeenCalled();
  });

  describe('server-side revalidation at confirm', () => {
    it('rejects the whole batch with 400 when a record is invalid', async () => {
      const bad = [record(), record({ row: 2, national_id: '12', email: 'luis@ctphojancha.ed.cr' })];

      const error = await service.executeBulkImport(bad as never, actor).catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({
        code: 'BULK_IMPORT_INVALID_ROWS',
        rows: [
          expect.objectContaining({
            row: 2,
            invalidFields: expect.arrayContaining(['national_id']),
          }),
        ],
      });
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('rejects a non-student role sent by the client', async () => {
      await expect(
        service.executeBulkImport([record({ role: 'DOCENTE' })] as never, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 409 when an email already exists in the database', async () => {
      usersRepository.findByNationalIdsOrEmails.mockResolvedValue([
        { national_id: '999999999', email: 'ana@ctphojancha.ed.cr' },
      ]);

      const error = await service.executeBulkImport(sampleRecords as never, actor).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        code: 'BULK_IMPORT_DUPLICATE',
        rows: [
          expect.objectContaining({ row: 1, invalidFields: expect.arrayContaining(['email']) }),
        ],
      });
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('returns 409 for duplicates inside the payload', async () => {
      const dup = [record(), record({ row: 2, email: 'otra@ctphojancha.ed.cr' })];
      await expect(service.executeBulkImport(dup as never, actor)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('maps ER_DUP_ENTRY during insert to 409 instead of 500', async () => {
      const dupError = new QueryFailedError('INSERT', [], new Error('Duplicate entry'));
      (dupError as unknown as { driverError: { code: string } }).driverError = {
        code: 'ER_DUP_ENTRY',
      };
      queryRunner.manager.save.mockRejectedValueOnce(dupError);

      const error = await service.executeBulkImport(sampleRecords as never, actor).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('section enrollment', () => {
    it('enrolls ACTIVE students whose section matches one active group', async () => {
      activeGroups = [group(12, '10-1')];
      const rows = [
        record({ section: ' 10-1 ' }),
        record({
          row: 2,
          national_id: '202220222',
          email: 'luis@ctphojancha.ed.cr',
          section: '10-1',
        }),
      ];

      const result = await service.executeBulkImport(rows as never, actor);

      expect(groupEnrollments.enrollNewStudentsInTransaction).toHaveBeenCalledWith(
        queryRunner.manager,
        expect.objectContaining({ groupId: 12, academicPeriodId: 7, userIds: [1, 2] }),
      );
      expect(result.enrolledCount).toBe(2);
      expect(result.notEnrolled).toEqual([]);
    });

    it('creates users without enrollment when section is missing, unknown or ambiguous', async () => {
      activeGroups = [group(12, '10-1'), group(13, '11-1'), { ...group(14, '11-1'), id: 14 }];
      const rows = [
        record({ section: '9-9' }),
        record({ row: 2, national_id: '202220222', email: 'luis@ctphojancha.ed.cr', section: '11-1' }),
        record({ row: 3, national_id: '303330333', email: 'eva@ctphojancha.ed.cr', section: null }),
      ];

      const result = await service.executeBulkImport(rows as never, actor);

      expect(result.importedCount).toBe(3);
      expect(result.enrolledCount).toBe(0);
      expect(result.notEnrolled.map((r) => r.row)).toEqual([1, 2, 3]);
      expect(result.notEnrolled[0].reason).toMatch(/no encontrada/);
      expect(result.notEnrolled[1].reason).toMatch(/ambigua/);
      expect(groupEnrollments.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
    });

    it('does not enroll inactive users', async () => {
      activeGroups = [group(12, '10-1')];
      const result = await service.executeBulkImport(
        [record({ section: '10-1', user_status: UserStatus.INACTIVE })] as never,
        actor,
      );
      expect(result.enrolledCount).toBe(0);
      expect(result.notEnrolled[0].reason).toMatch(/no activo/);
    });

    it('rolls back everything when the group capacity is exceeded', async () => {
      activeGroups = [group(12, '10-1', 1)];
      groupEnrollments.enrollNewStudentsInTransaction.mockRejectedValue(
        new ConflictException({ code: 'GROUP_CAPACITY_EXCEEDED' }),
      );

      await expect(
        service.executeBulkImport([record({ section: '10-1' })] as never, actor),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  it('audits USER_CREATED per user with the admin as actor and BULK_IMPORT source', async () => {
    activeGroups = [group(12, '10-1')];
    await service.executeBulkImport(
      [record({ section: '10-1' }), sampleRecords[1]] as never,
      actor,
    );

    const audited = auditRepo.save.mock.calls[0][0];
    expect(audited).toHaveLength(2);
    expect(audited[0]).toMatchObject({
      actorId: 1,
      action: 'USER_CREATED',
      entity: 'User',
      after: { source: 'BULK_IMPORT', groupId: 12 },
    });
    expect(audited[1].after).toMatchObject({ groupId: null });
    expect(JSON.stringify(audited)).not.toMatch(/password/i);
  });
});
