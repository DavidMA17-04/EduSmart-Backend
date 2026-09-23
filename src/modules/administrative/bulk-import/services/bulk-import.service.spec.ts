import * as bcrypt from 'bcrypt';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { BulkImportService } from './bulk-import.service';
import { UserRoleEnum } from '../dto/bulk-import.dto';

describe('BulkImportService credentials dispatch', () => {
  let rolesRepository: { findAll: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      create: jest.Mock;
      save: jest.Mock;
    };
  };
  let dataSource: { createQueryRunner: jest.Mock };
  let service: BulkImportService;
  let nextUserId: number;

  const studentRole = { id: 3, name: 'Estudiante' };

  const sampleRecords = [
    {
      national_id: '101110111',
      name: 'Ana',
      first_lastname: 'Pérez',
      second_lastname: 'Solís',
      email: 'ana@ctphojancha.ed.cr',
      phone: null,
      role: UserRoleEnum.ESTUDIANTE,
      user_status: UserStatus.ACTIVE,
    },
    {
      national_id: '202220222',
      name: 'Luis',
      first_lastname: 'Mora',
      second_lastname: null,
      email: 'luis@ctphojancha.ed.cr',
      phone: null,
      role: UserRoleEnum.ESTUDIANTE,
      user_status: UserStatus.ACTIVE,
    },
  ];

  beforeEach(() => {
    nextUserId = 1;
    rolesRepository = {
      findAll: jest.fn().mockResolvedValue([studentRole]),
    };
    mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'APP_PUBLIC_URL') return 'http://localhost:5173';
        return undefined;
      }),
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
      },
    };
    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    service = new BulkImportService(
      {} as never,
      rolesRepository as never,
      dataSource as never,
      {} as never,
      mailService as never,
      configService as never,
    );
  });

  it('generates unique temporary passwords (not the legacy shared secret)', () => {
    const a = service.generateTemporaryPassword();
    const b = service.generateTemporaryPassword();
    expect(a).not.toEqual(b);
    expect(a).not.toBe('EduSmart2026*');
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it('hashes per-user passwords and emails credentials after commit', async () => {
    const result = await service.executeBulkImport(sampleRecords as never);

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

    await expect(service.executeBulkImport(sampleRecords as never)).rejects.toThrow();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('keeps imported users when SMTP fails after commit', async () => {
    mailService.sendMail.mockRejectedValue(new Error('smtp down'));

    const result = await service.executeBulkImport(sampleRecords as never);

    expect(result.importedCount).toBe(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(mailService.sendMail).toHaveBeenCalled();
  });
});
