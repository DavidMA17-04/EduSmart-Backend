import { Role } from '../../../common/enums/role.enum';
import { AttendanceHistoryService } from './attendance-history.service';

describe('AttendanceHistoryService', () => {
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  const attendance = {
    createQueryBuilder: jest.fn(() => qb),
  };

  const sessionsService = {
    isAdminActor: jest.fn(),
  };

  let service: AttendanceHistoryService;

  const teacher = {
    id: 10,
    email: 't@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.view'],
    mustChangePassword: false,
  };

  const admin = {
    ...teacher,
    id: 1,
    roles: [Role.ADMIN],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qb.clone.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(1);
    qb.getMany.mockResolvedValue([
      {
        id: 900,
        status: 'PRESENT',
        registrationMethod: 'MANUAL',
        registeredAt: new Date('2026-09-11T15:00:00.000Z'),
        session: {
          id: 50,
          sessionDate: '2026-09-11',
          startedAt: new Date('2026-09-11T14:00:00.000Z'),
          teachingAssignment: {
            id: 100,
            userId: 10,
            groupId: 20,
            offeringKind: 'SUBJECT',
            subjectId: 7,
            specialtyId: null,
            group: { name: '7-1', section: { gradeLevel: 7 } },
            subject: { name: 'Matemática' },
            specialty: null,
            user: {
              name: 'Luis',
              first_lastname: 'Docente',
              second_lastname: null,
            },
          },
        },
        student: {
          id: 501,
          national_id: '1-1111-1111',
          name: 'Ana',
          first_lastname: 'Pérez',
          second_lastname: null,
        },
      },
    ]);
    service = new AttendanceHistoryService(
      attendance as never,
      sessionsService as never,
    );
  });

  it('scopes non-admin teachers to their teaching assignments', async () => {
    sessionsService.isAdminActor.mockReturnValue(false);

    const page = await service.search({ page: 1, limit: 10 }, teacher);

    expect(sessionsService.isAdminActor).toHaveBeenCalledWith(teacher);
    expect(qb.andWhere).toHaveBeenCalledWith('ta.id_users = :teacherId', {
      teacherId: 10,
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.student.fullName).toBe('Ana Pérez');
    expect(page.items[0]?.offering.name).toBe('Matemática');
    expect(page.items[0]?.registrationMethod).toBe('MANUAL');
  });

  it('does not scope admin actors by teacher id', async () => {
    sessionsService.isAdminActor.mockReturnValue(true);

    await service.search(
      {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        groupId: 20,
        status: 'LATE' as never,
        registrationMethod: 'TOKEN' as never,
        search: 'ana',
      },
      admin,
    );

    const teacherScopeCalls = qb.andWhere.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ta.id_users = :teacherId',
    );
    expect(teacherScopeCalls).toHaveLength(0);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'session.session_date >= :startDate',
      { startDate: '2026-09-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'session.session_date <= :endDate',
      { endDate: '2026-09-30' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('ta.id_groups = :groupId', {
      groupId: 20,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('a.status = :status', {
      status: 'LATE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'a.registration_method = :registrationMethod',
      { registrationMethod: 'TOKEN' },
    );
  });

  it('paginates with totalPages', async () => {
    sessionsService.isAdminActor.mockReturnValue(true);
    qb.getCount.mockResolvedValue(55);

    const page = await service.search({ page: 2, limit: 25 }, admin);

    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(25);
    expect(page.total).toBe(55);
    expect(page.totalPages).toBe(3);
  });
});
