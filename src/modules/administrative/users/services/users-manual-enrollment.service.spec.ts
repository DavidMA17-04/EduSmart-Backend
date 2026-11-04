import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersService } from './users.service';

describe('UsersService.create manual enrollment', () => {
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    replaceRoles: jest.Mock;
    findById: jest.Mock;
    findByNationalId: jest.Mock;
    findByEmail: jest.Mock;
  };
  let rolesRepository: { findById: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let accountVerificationService: { issueAndSend: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let departmentsService: { getByIdOrFail: jest.Mock };
  let teacherProfiles: {
    findOne: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let groupEnrollmentsQuery: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let groupEnrollmentsService: {
    requireGroupForEnrollment: jest.Mock;
    enrollNewStudentsInTransaction: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let manager: {
    getRepository: jest.Mock;
  };
  let service: UsersService;
  let userRepo: { save: jest.Mock };
  let roleRepo: { save: jest.Mock; create: jest.Mock };
  let auditRepo: { save: jest.Mock; create: jest.Mock };

  const studentRole = { id: 3, name: 'Estudiante', status: 'ACTIVE' };
  const teacherRole = { id: 1, name: 'Docente', status: 'ACTIVE' };

  const persistedStudent = {
    id: 50,
    national_id: '109870999',
    nationalId: '109870999',
    name: 'Luis',
    first_lastname: 'Mora',
    second_lastname: null,
    email: 'luis.mora@ctphojancha.ed.cr',
    phone: null,
    password_hash: 'hash',
    mustChangePassword: true,
    status: UserStatus.ACTIVE,
    roles: [studentRole],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function studentDto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      nationalId: '109870999',
      name: 'Luis',
      first_lastname: 'Mora',
      email: 'luis.mora@ctphojancha.ed.cr',
      status: UserStatus.ACTIVE,
      roleIds: [3],
      password: 'Temporal1!',
      groupId: 12,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (user) => ({ ...user, id: 50 })),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(persistedStudent),
      findByNationalId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    rolesRepository = {
      findById: jest.fn().mockResolvedValue(studentRole),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    accountVerificationService = { issueAndSend: jest.fn().mockResolvedValue(undefined) };
    mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    departmentsService = {
      getByIdOrFail: jest.fn().mockResolvedValue({ id: 1, code: 'CIENCIAS', name: 'Ciencias' }),
    };
    teacherProfiles = {
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    };

    const enrollmentQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        groupId: 12,
        academicPeriodId: 4,
        startsOn: '2026-02-01',
        status: 'ACTIVE',
        group: { name: '10-1', section: { gradeLevel: 10 }, specialty: null },
        academicPeriod: { name: '2026' },
      }),
    };
    groupEnrollmentsQuery = {
      createQueryBuilder: jest.fn().mockReturnValue(enrollmentQb),
      findOne: jest.fn().mockResolvedValue(null),
    };

    userRepo = { save: jest.fn(async (user) => ({ ...user, id: 50, email: user.email })) };
    roleRepo = { save: jest.fn().mockResolvedValue(undefined), create: jest.fn((row) => row) };
    auditRepo = { save: jest.fn().mockResolvedValue(undefined), create: jest.fn((row) => row) };
    manager = {
      getRepository: jest.fn((entity: { name?: string }) => {
        const name = entity?.name ?? '';
        if (name === 'User') return userRepo;
        if (name === 'UserRoleEntity') return roleRepo;
        if (name === 'AuditLog') return auditRepo;
        return { save: jest.fn(), create: jest.fn((row) => row) };
      }),
    };
    dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<number>) => fn(manager)),
    };
    groupEnrollmentsService = {
      requireGroupForEnrollment: jest.fn().mockResolvedValue({
        groupId: 12,
        groupName: '10-1',
        academicPeriodId: 4,
        periodStartDate: '2026-02-01',
      }),
      enrollNewStudentsInTransaction: jest.fn().mockResolvedValue([{ id: 1 }]),
    };

    service = new UsersService(
      repository as never,
      rolesRepository as never,
      auditLogService as never,
      accountVerificationService as never,
      departmentsService as never,
      {} as never,
      teacherProfiles as never,
      groupEnrollmentsQuery as never,
      mailService as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      groupEnrollmentsService as never,
      dataSource as never,
    );
  });

  it('crea Estudiante ACTIVE con sección y adjunta matrícula', async () => {
    const view = await service.create(studentDto(), 7);

    expect(view.id).toBe(50);
    expect(view.enrollment).toEqual(
      expect.objectContaining({
        groupId: 12,
        groupName: '10-1',
        status: 'ACTIVE',
      }),
    );
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ groupId: 12, academicPeriodId: 4, userIds: [50] }),
    );
    expect(auditRepo.save).toHaveBeenCalled();
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        entityId: '50',
        after: expect.objectContaining({ groupId: 12 }),
      }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rechaza Estudiante ACTIVE sin groupId y no persiste', async () => {
    await expect(service.create(studentDto({ groupId: undefined }), 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('rechaza groupId en un Docente y no persiste', async () => {
    rolesRepository.findById.mockResolvedValue(teacherRole);
    await expect(
      service.create(
        {
          nationalId: '109870543',
          name: 'María',
          first_lastname: 'Vargas',
          email: 'maria@ctphojancha.ed.cr',
          status: UserStatus.ACTIVE,
          roleIds: [1],
          departmentId: 1,
          password: 'Temporal1!',
          groupId: 12,
        },
        7,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza Estudiante PENDING con groupId y no persiste', async () => {
    await expect(
      service.create(studentDto({ status: UserStatus.PENDING }), 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('cupo lleno → 400 y no envía correo', async () => {
    groupEnrollmentsService.enrollNewStudentsInTransaction.mockRejectedValue(
      new ConflictException({
        code: 'GROUP_CAPACITY_EXCEEDED',
        message: 'El cupo de la sección "10-1" no alcanza: 30/30 ocupados y se intentan matricular 1.',
      }),
    );

    await expect(service.create(studentDto(), 7)).rejects.toBeInstanceOf(BadRequestException);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('grupo inexistente → 404 y no persiste usuario', async () => {
    groupEnrollmentsService.requireGroupForEnrollment.mockRejectedValue(
      new NotFoundException('Group 99 not found'),
    );

    await expect(service.create(studentDto({ groupId: 99 }), 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('Docente sin groupId sigue el alta normal', async () => {
    rolesRepository.findById.mockResolvedValue(teacherRole);
    repository.findById.mockResolvedValue({
      ...persistedStudent,
      id: 42,
      roles: [teacherRole],
      email: 'maria.active@ctphojancha.ed.cr',
    });

    const view = await service.create(
      {
        nationalId: '109870543',
        name: 'María',
        first_lastname: 'Vargas',
        email: 'maria.active@ctphojancha.ed.cr',
        status: UserStatus.ACTIVE,
        roleIds: [1],
        departmentId: 1,
        password: 'Temporal1!',
      },
      7,
    );

    expect(view.status).toBe(UserStatus.ACTIVE);
    expect(view.enrollment).toBeUndefined();
    expect(repository.save).toHaveBeenCalled();
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalled();
  });
});

describe('UsersService.update manual enrollment', () => {
  let repository: {
    save: jest.Mock;
    replaceRoles: jest.Mock;
    findById: jest.Mock;
    findByNationalId: jest.Mock;
    findByEmail: jest.Mock;
  };
  let rolesRepository: { findById: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let groupEnrollmentsQuery: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let groupEnrollmentsService: {
    requireGroupForEnrollment: jest.Mock;
    enrollNewStudentsInTransaction: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let service: UsersService;

  const studentRole = { id: 3, name: 'Estudiante', status: 'ACTIVE' };
  const teacherRole = { id: 1, name: 'Docente', status: 'ACTIVE' };
  const persistedStudent = {
    id: 50,
    national_id: '109870999',
    nationalId: '109870999',
    name: 'Luis',
    first_lastname: 'Mora',
    second_lastname: null,
    email: 'luis.mora@ctphojancha.ed.cr',
    phone: null,
    password_hash: 'hash',
    mustChangePassword: true,
    status: UserStatus.ACTIVE,
    roles: [studentRole],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      save: jest.fn(async (user) => user),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ ...persistedStudent }),
      findByNationalId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    rolesRepository = { findById: jest.fn().mockResolvedValue(studentRole) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    const enrollmentQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        groupId: 12,
        academicPeriodId: 4,
        startsOn: '2026-02-01',
        status: 'ACTIVE',
        group: { name: '10-1', section: { gradeLevel: 10 }, specialty: null },
        academicPeriod: { name: '2026' },
      }),
    };
    groupEnrollmentsQuery = {
      createQueryBuilder: jest.fn().mockReturnValue(enrollmentQb),
      findOne: jest.fn().mockResolvedValue(null),
    };
    manager = { getRepository: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<void>) => fn(manager)),
    };
    groupEnrollmentsService = {
      requireGroupForEnrollment: jest.fn().mockResolvedValue({
        groupId: 12,
        groupName: '10-1',
        academicPeriodId: 4,
        periodStartDate: '2026-02-01',
      }),
      enrollNewStudentsInTransaction: jest.fn().mockResolvedValue([{ id: 1 }]),
    };

    service = new UsersService(
      repository as never,
      rolesRepository as never,
      auditLogService as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null), delete: jest.fn(), save: jest.fn(), create: jest.fn() } as never,
      groupEnrollmentsQuery as never,
      {} as never,
      {} as never,
      groupEnrollmentsService as never,
      dataSource as never,
    );
  });

  it('GET /users/:id adjunta enrollment vigente o null', async () => {
    const withEnrollment = await service.findOne(50);
    expect(withEnrollment.enrollment).toEqual(
      expect.objectContaining({ groupId: 12, groupName: '10-1' }),
    );

    const qb = groupEnrollmentsQuery.createQueryBuilder();
    qb.getOne.mockResolvedValueOnce(null);
    const without = await service.findOne(50);
    expect(without.enrollment).toBeNull();
  });

  it('PATCH matricula Estudiante ACTIVE sin matrícula', async () => {
    const view = await service.update(50, { groupId: 12 }, 7);

    expect(view.enrollment).toEqual(expect.objectContaining({ groupId: 12 }));
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ groupId: 12, academicPeriodId: 4, userIds: [50] }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_UPDATED',
        after: expect.objectContaining({ groupId: 12 }),
      }),
    );
  });

  it('PATCH sin groupId no toca matrícula', async () => {
    await service.update(50, { phone: '88881111' }, 7);

    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
    expect(groupEnrollmentsQuery.findOne).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });

  it('rechaza groupId distinto si ya tiene sección', async () => {
    groupEnrollmentsQuery.findOne.mockResolvedValue({ groupId: 2, status: 'ACTIVE' });

    await expect(service.update(50, { groupId: 5 }, 7)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
  });

  it('mismo groupId es no-op si ya está matriculado', async () => {
    groupEnrollmentsQuery.findOne.mockResolvedValue({ groupId: 12, status: 'ACTIVE' });

    await service.update(50, { groupId: 12 }, 7);

    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });

  it('rechaza groupId en un Docente y no matricula', async () => {
    repository.findById.mockResolvedValue({ ...persistedStudent, roles: [teacherRole] });
    rolesRepository.findById.mockResolvedValue(teacherRole);

    await expect(service.update(50, { roleIds: [1], groupId: 12 }, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).not.toHaveBeenCalled();
  });

  it('rechaza Estudiante PENDING con groupId', async () => {
    repository.findById.mockResolvedValue({ ...persistedStudent, status: UserStatus.PENDING });

    await expect(
      service.update(50, { status: UserStatus.PENDING, groupId: 12 }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('cupo lleno en edición → 400 y no abre matrícula', async () => {
    groupEnrollmentsService.enrollNewStudentsInTransaction.mockRejectedValue(
      new ConflictException({
        code: 'GROUP_CAPACITY_EXCEEDED',
        message: 'El cupo de la sección "10-1" no alcanza: 30/30 ocupados y se intentan matricular 1.',
      }),
    );

    await expect(service.update(50, { groupId: 12 }, 7)).rejects.toBeInstanceOf(BadRequestException);
    expect(groupEnrollmentsService.enrollNewStudentsInTransaction).toHaveBeenCalled();
  });
});
