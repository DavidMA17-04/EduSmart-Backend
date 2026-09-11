import { BadRequestException, ConflictException } from '@nestjs/common';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { TeachingAssignmentsService } from './teaching-assignments.service';

describe('TeachingAssignmentsService eligibility', () => {
  const eligibility = {
    resolveOffering: jest.fn(),
    assertOfferingAllowedForGroup: jest.fn(),
  };
  const repository = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => ({ ...row, id: row.id ?? 99 })),
    findOne: jest.fn(),
  };
  const groups = {
    findOne: jest.fn(),
  };
  const users = {
    findOne: jest.fn(),
  };

  let service: TeachingAssignmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeachingAssignmentsService(
      repository as never,
      groups as never,
      users as never,
      eligibility as never,
    );

    users.findOne.mockResolvedValue({
      id: 5,
      status: 'ACTIVE',
      userRoles: [{ role: { name: 'Docente', status: 'ACTIVE' } }],
    });
    groups.findOne.mockResolvedValue({
      id: 10,
      academicPeriodId: 1,
      section: { gradeLevel: 8 },
    });
    repository.findOne.mockResolvedValue(null);
  });

  async function createWith(
    offeringKind: AcademicOfferingKind,
    extra: { subjectId?: number; specialtyId?: number } = {},
  ) {
    return service.create({
      userId: 5,
      groupId: 10,
      offeringKind,
      subjectId: extra.subjectId,
      specialtyId: extra.specialtyId,
    });
  }

  it('subject válido para 8.º → OK', async () => {
    groups.findOne.mockResolvedValue({
      id: 10,
      academicPeriodId: 1,
      section: { gradeLevel: 8 },
    });
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.SUBJECT,
      subjectId: 1,
      specialtyId: null,
      name: 'Matemáticas',
    });
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 99,
        offeringKind: AcademicOfferingKind.SUBJECT,
        subjectId: 1,
      });

    await expect(
      createWith(AcademicOfferingKind.SUBJECT, { subjectId: 1 }),
    ).resolves.toMatchObject({ id: 99 });
    expect(eligibility.assertOfferingAllowedForGroup).toHaveBeenCalledWith(
      10,
      AcademicOfferingKind.SUBJECT,
    );
  });

  it('workshop válido para 8.º → OK', async () => {
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      subjectId: null,
      specialtyId: 2,
      name: 'Robótica',
    });
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 100 });

    await expect(
      createWith(AcademicOfferingKind.EXPLORATORY_WORKSHOP, {
        specialtyId: 2,
      }),
    ).resolves.toMatchObject({ id: 100 });
  });

  it('specialty para 8.º → reject', async () => {
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
      subjectId: null,
      specialtyId: 3,
      name: 'Desarrollo',
    });
    eligibility.assertOfferingAllowedForGroup.mockRejectedValue(
      new BadRequestException('not allowed'),
    );

    await expect(
      createWith(AcademicOfferingKind.TECHNICAL_SPECIALTY, {
        specialtyId: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('specialty para 11.º → OK', async () => {
    groups.findOne.mockResolvedValue({
      id: 11,
      academicPeriodId: 1,
      section: { gradeLevel: 11 },
    });
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
      subjectId: null,
      specialtyId: 3,
      name: 'Desarrollo',
    });
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(11);
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 101 });

    await expect(
      service.create({
        userId: 5,
        groupId: 11,
        offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
        specialtyId: 3,
      }),
    ).resolves.toMatchObject({ id: 101 });
  });

  it('workshop para 11.º → reject', async () => {
    groups.findOne.mockResolvedValue({
      id: 11,
      academicPeriodId: 1,
      section: { gradeLevel: 11 },
    });
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      subjectId: null,
      specialtyId: 2,
      name: 'Robótica',
    });
    eligibility.assertOfferingAllowedForGroup.mockRejectedValue(
      new BadRequestException('not allowed'),
    );

    await expect(
      service.create({
        userId: 5,
        groupId: 11,
        offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
        specialtyId: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kind/FK inconsistente → reject', async () => {
    eligibility.resolveOffering.mockRejectedValue(
      new BadRequestException({ code: 'OFFERING_KIND_FK_MISMATCH' }),
    );

    await expect(
      createWith(AcademicOfferingKind.SUBJECT, { specialtyId: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('duplicado → reject', async () => {
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.SUBJECT,
      subjectId: 1,
      specialtyId: null,
      name: 'Matemáticas',
    });
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    repository.findOne.mockResolvedValue({ id: 50 });

    await expect(
      createWith(AcademicOfferingKind.SUBJECT, { subjectId: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps specialty kind mismatch through resolveOffering', async () => {
    eligibility.resolveOffering.mockRejectedValue(
      new BadRequestException({
        code: 'OFFERING_SPECIALTY_KIND_MISMATCH',
        expected: SpecialtyKind.EXPLORATORY_WORKSHOP,
      }),
    );
    await expect(
      createWith(AcademicOfferingKind.EXPLORATORY_WORKSHOP, {
        specialtyId: 9,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TeachingAssignmentsService.list filters', () => {
  const eligibility = {
    resolveOffering: jest.fn(),
    assertOfferingAllowedForGroup: jest.fn(),
  };
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const groups = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };

  let service: TeachingAssignmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeachingAssignmentsService(
      repository as never,
      groups as never,
      users as never,
      eligibility as never,
    );
    repository.find.mockResolvedValue([]);
  });

  it('lists only impartibles (offeringKind Not IsNull) without filters', async () => {
    await service.list();
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          offeringKind: expect.anything(),
        }),
      }),
    );
    const where = repository.find.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('groupId');
    expect(where).not.toHaveProperty('userId');
    expect(where).not.toHaveProperty('academicPeriodId');
  });

  it('filters by teacherId → userId', async () => {
    await service.list({ teacherId: 520 });
    expect(repository.find.mock.calls[0][0].where).toMatchObject({
      userId: 520,
    });
  });

  it('filters by groupId', async () => {
    await service.list({ groupId: 3 });
    expect(repository.find.mock.calls[0][0].where).toMatchObject({
      groupId: 3,
    });
  });

  it('filters by periodId → academicPeriodId', async () => {
    await service.list({ periodId: 1 });
    expect(repository.find.mock.calls[0][0].where).toMatchObject({
      academicPeriodId: 1,
    });
  });

  it('combines teacherId + groupId + periodId', async () => {
    await service.list({ teacherId: 5, groupId: 10, periodId: 2 });
    expect(repository.find.mock.calls[0][0].where).toMatchObject({
      userId: 5,
      groupId: 10,
      academicPeriodId: 2,
    });
  });

  it('findByGroup delegates to list({ groupId })', async () => {
    const spy = jest.spyOn(service, 'list').mockResolvedValue([]);
    await service.findByGroup(7);
    expect(spy).toHaveBeenCalledWith({ groupId: 7 });
  });
});
