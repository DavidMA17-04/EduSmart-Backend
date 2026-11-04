import { BadRequestException } from '@nestjs/common';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { AcademicOfferingEligibilityService } from './academic-offering-eligibility.service';

describe('AcademicOfferingEligibilityService.resolveOffering', () => {
  const groups = { findOne: jest.fn() };
  const subjects = { findOne: jest.fn() };
  const specialties = { findOne: jest.fn() };
  let service: AcademicOfferingEligibilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcademicOfferingEligibilityService(
      groups as never,
      subjects as never,
      specialties as never,
    );
  });

  it('rejects both FKs null', async () => {
    await expect(
      service.resolveOffering({
        offeringKind: AcademicOfferingKind.SUBJECT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SUBJECT pointing at specialty only', async () => {
    await expect(
      service.resolveOffering({
        offeringKind: AcademicOfferingKind.SUBJECT,
        specialtyId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects WORKSHOP with TECHNICAL specialty row', async () => {
    specialties.findOne.mockResolvedValue({
      id: 3,
      name: 'Dev',
      kind: SpecialtyKind.TECHNICAL_SPECIALTY,
    });
    await expect(
      service.resolveOffering({
        offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
        specialtyId: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves SUBJECT', async () => {
    subjects.findOne.mockResolvedValue({ id: 1, name: 'Matemáticas' });
    await expect(
      service.resolveOffering({
        offeringKind: AcademicOfferingKind.SUBJECT,
        subjectId: 1,
      }),
    ).resolves.toEqual({
      kind: AcademicOfferingKind.SUBJECT,
      subjectId: 1,
      specialtyId: null,
      name: 'Matemáticas',
    });
  });
});
