import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { GroupEntity } from '../../sections/entities/group.entity';
import { SpecialtyEntity } from '../../specialties/entities/specialty.entity';
import { SubjectEntity } from '../../subjects/entities/subject.entity';
import { AcademicOfferingEligibilityPolicy } from '../policies/academic-offering-eligibility.policy';

export type ResolvedOffering = {
  kind: AcademicOfferingKind;
  subjectId: number | null;
  specialtyId: number | null;
  name: string;
};

@Injectable()
export class AcademicOfferingEligibilityService {
  private readonly policy = new AcademicOfferingEligibilityPolicy();

  constructor(
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjects: Repository<SubjectEntity>,
    @InjectRepository(SpecialtyEntity)
    private readonly specialties: Repository<SpecialtyEntity>,
  ) {}

  getPolicy(): AcademicOfferingEligibilityPolicy {
    return this.policy;
  }

  async getGradeLevelForGroup(groupId: number): Promise<number> {
    const group = await this.groups.findOne({
      where: { id: groupId },
      relations: { section: true },
    });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);
    if (!group.section) {
      throw new BadRequestException(`Group ${groupId} has no section loaded`);
    }
    return group.section.gradeLevel;
  }

  async assertOfferingAllowedForGroup(
    groupId: number,
    kind: AcademicOfferingKind,
  ): Promise<number> {
    const grade = await this.getGradeLevelForGroup(groupId);
    this.policy.assertKindAllowedForGrade(kind, grade);
    return grade;
  }

  /**
   * Resolves offering FKs + kind coherence (no grade check).
   */
  async resolveOffering(input: {
    offeringKind: AcademicOfferingKind;
    subjectId?: number | null;
    specialtyId?: number | null;
  }): Promise<ResolvedOffering> {
    const { offeringKind, subjectId, specialtyId } = input;
    const hasSubject = subjectId != null;
    const hasSpecialty = specialtyId != null;

    if (hasSubject === hasSpecialty) {
      throw new BadRequestException({
        code: 'OFFERING_FK_XOR_REQUIRED',
        message:
          'Exactly one of subjectId or specialtyId must be set according to offeringKind',
      });
    }

    if (offeringKind === AcademicOfferingKind.SUBJECT) {
      if (!hasSubject || hasSpecialty) {
        throw new BadRequestException({
          code: 'OFFERING_KIND_FK_MISMATCH',
          message: 'SUBJECT requires subjectId and null specialtyId',
        });
      }
      const subject = await this.subjects.findOne({ where: { id: subjectId! } });
      if (!subject) throw new NotFoundException(`Subject ${subjectId} not found`);
      return {
        kind: AcademicOfferingKind.SUBJECT,
        subjectId: subject.id,
        specialtyId: null,
        name: subject.name,
      };
    }

    if (!hasSpecialty || hasSubject) {
      throw new BadRequestException({
        code: 'OFFERING_KIND_FK_MISMATCH',
        message: `${offeringKind} requires specialtyId and null subjectId`,
      });
    }

    const specialty = await this.specialties.findOne({
      where: { id: specialtyId! },
    });
    if (!specialty) {
      throw new NotFoundException(`Specialty ${specialtyId} not found`);
    }

    const expectedKind =
      offeringKind === AcademicOfferingKind.EXPLORATORY_WORKSHOP
        ? SpecialtyKind.EXPLORATORY_WORKSHOP
        : SpecialtyKind.TECHNICAL_SPECIALTY;

    if (specialty.kind !== expectedKind) {
      throw new BadRequestException({
        code: 'OFFERING_SPECIALTY_KIND_MISMATCH',
        message: `Specialty ${specialty.id} kind is ${specialty.kind}, expected ${expectedKind}`,
      });
    }

    return {
      kind: offeringKind,
      subjectId: null,
      specialtyId: specialty.id,
      name: specialty.name,
    };
  }

  /**
   * Ready for future GET available-offerings: kinds allowed for a group's grade.
   */
  async allowedKindsForGroup(groupId: number): Promise<AcademicOfferingKind[]> {
    const grade = await this.getGradeLevelForGroup(groupId);
    return this.policy.allowedKindsForGrade(grade);
  }
}
