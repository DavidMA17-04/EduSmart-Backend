import { AdministrativeReportsService } from './administrative-reports.service';
import { UserStatus } from '../../../../common/enums/user-status.enum';

describe('AdministrativeReportsService', () => {
  let service: AdministrativeReportsService;
  let repository: {
    findUsers: jest.Mock;
    findAcademicStructure: jest.Mock;
    findAcademicPeriods: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findUsers: jest.fn().mockResolvedValue([
        {
          id: 1,
          national_id: '123456789',
          name: 'Carlos',
          first_lastname: 'Mora',
          second_lastname: 'Castro',
          email: 'carlos@test.com',
          phone: '88888888',
          status: UserStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
          userRoles: [{ role: { name: 'DOCENTE' } }],
        },
      ]),
      findAcademicStructure: jest.fn().mockResolvedValue([
        {
          id: 10,
          name: 'Grupo A',
          studentCount: 25,
          sectionId: 1,
          status: 'ACTIVE',
          section: {
            id: 1,
            name: '10-1',
            gradeLevel: 10,
            specialty: { name: 'Informática' },
          },
          academicPeriod: { name: '2026-1' },
          teachingAssignments: [
            {
              isGuideTeacher: true,
              user: {
                name: 'Ana',
                first_lastname: 'Solís',
                second_lastname: 'Méndez',
              },
            },
          ],
        },
      ]),
      findAcademicPeriods: jest.fn().mockResolvedValue([
        {
          id: 5,
          name: 'Periodo 1',
          startDate: '2026-02-01',
          endDate: '2026-06-30',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-01'),
        },
      ]),
    };

    service = new AdministrativeReportsService(repository as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsersReport', () => {
    it('should map users to report items correctly', async () => {
      const result = await service.getUsersReport({});
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        nationalId: '123456789',
        fullName: 'Carlos Mora Castro',
        email: 'carlos@test.com',
        phone: '88888888',
        roles: ['DOCENTE'],
        status: UserStatus.ACTIVE,
        createdAt: expect.any(Date),
      });
      expect(repository.findUsers).toHaveBeenCalledWith({});
    });
  });

  describe('getAcademicStructureReport', () => {
    it('should map group structure and guide teacher correctly', async () => {
      const result = await service.getAcademicStructureReport({});
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        groupId: 10,
        groupName: 'Grupo A',
        studentCount: 25,
        sectionId: 1,
        sectionName: '10-1',
        gradeLevel: 10,
        specialty: 'Informática',
        academicPeriod: '2026-1',
        guideTeacher: 'Ana Solís Méndez',
        status: 'ACTIVE',
      });
    });
  });

  describe('getAcademicPeriodsReport', () => {
    it('should map academic periods report correctly', async () => {
      const result = await service.getAcademicPeriodsReport({});
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 5,
        name: 'Periodo 1',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        status: 'ACTIVE',
        createdAt: expect.any(Date),
      });
    });
  });
});
