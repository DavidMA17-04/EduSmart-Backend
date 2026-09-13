import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { In, Repository } from 'typeorm';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceJustificationStatus } from '../../../common/enums/attendance-justification-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateJustificationDto } from '../dto/create-justification.dto';
import { JustifiableAbsencesQueryDto } from '../dto/justifiable-absences-query.dto';
import { ListJustificationsQueryDto } from '../dto/list-justifications-query.dto';
import {
  JustificationReviewDecision,
  ReviewJustificationDto,
} from '../dto/review-justification.dto';
import { AbsenceJustification } from '../entities/absence-justification.entity';
import { Attendance } from '../entities/attendance.entity';
import { GuardianStudentLink } from '../entities/guardian-student-link.entity';
import { JustificationEvidence } from '../entities/justification-evidence.entity';
import { formatUserFullName } from '../utils/attendance-labels.util';

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXT = /^\.(pdf|jpe?g|png)$/i;

export type JustificationEvidenceView = {
  id: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
  uploadedByUserId: number;
  createdAt: Date;
};

export type JustificationListItemView = {
  id: number;
  status: JustificationStatus;
  reason: string;
  decisionNotes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: number | null;
  attendanceId: number;
  sessionDate: string;
  student: { userId: number; fullName: string; nationalId: string };
  group: { id: number; name: string };
  offering: { name: string; kind: string | null };
  evidences: JustificationEvidenceView[];
};

export type JustificationListPageView = {
  data: JustificationListItemView[];
  total: number;
  page: number;
  pageSize: number;
};

const JUSTIFICATIONS_DEFAULT_PAGE_SIZE = 20;
const JUSTIFICATIONS_MAX_PAGE_SIZE = 100;

/** Selectable ABSENT mark for WF-39 (justifiable absence candidate). */
export type JustifiableAbsenceView = {
  attendanceId: number;
  sessionDate: string;
  offeringName: string;
  groupName: string;
  studentFullName: string;
};

@Injectable()
export class JustificationsService {
  private readonly uploadDir = join(process.cwd(), 'uploads', 'justifications');

  constructor(
    @InjectRepository(AbsenceJustification)
    private readonly justifications: Repository<AbsenceJustification>,
    @InjectRepository(JustificationEvidence)
    private readonly evidences: Repository<JustificationEvidence>,
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(GuardianStudentLink)
    private readonly guardianLinks: Repository<GuardianStudentLink>,
  ) {
    this.ensureUploadDir();
  }

  async createJustification(
    dto: CreateJustificationDto,
    actor: AuthenticatedUser,
  ): Promise<JustificationListItemView> {
    const mark = await this.attendance.findOne({
      where: { id: dto.attendanceId },
      relations: {
        student: true,
        session: {
          teachingAssignment: {
            group: true,
            subject: true,
            specialty: true,
          },
        },
      },
    });

    if (!mark) {
      throw new NotFoundException({
        code: 'ATTENDANCE_NOT_FOUND',
        message: 'Registro de asistencia no encontrado',
      });
    }

    if (mark.status !== AttendanceStatus.ABSENT) {
      throw new BadRequestException({
        code: 'ATTENDANCE_NOT_ABSENT',
        message: 'Solo se pueden justificar registros en estado ABSENT',
      });
    }

    const canReview = this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW);
    const isOwn = mark.studentUserId === actor.id;
    const isRepresented =
      !isOwn && !canReview ? await this.isMyRepresented(actor.id, mark.studentUserId) : false;
    if (!canReview && !isOwn && !isRepresented) {
      throw new ForbiddenException({
        code: 'JUSTIFICATION_NOT_ALLOWED',
        message: 'Solo puede justificar ausencias propias o de sus representados',
      });
    }

    const active = await this.justifications.findOne({
      where: {
        attendanceId: mark.id,
        status: In([JustificationStatus.PENDING, JustificationStatus.APPROVED]),
      },
    });
    if (active) {
      throw new ConflictException({
        code: 'JUSTIFICATION_ALREADY_ACTIVE',
        message: 'Ya existe una justificación pendiente o aprobada para esta ausencia',
      });
    }

    const row = this.justifications.create({
      attendanceId: mark.id,
      reason: dto.reason.trim(),
      status: JustificationStatus.PENDING,
      createdByUserId: actor.id,
    });
    const saved = await this.justifications.save(row);

    mark.justificationStatus = AttendanceJustificationStatus.PENDING;
    await this.attendance.save(mark);

    return this.toView(await this.loadJustificationOrFail(saved.id));
  }

  async uploadEvidence(
    justificationId: number,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<JustificationEvidenceView> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'EVIDENCE_FILE_REQUIRED',
        message: 'Se requiere un archivo',
      });
    }

    if (file.size > MAX_EVIDENCE_BYTES || file.buffer.length > MAX_EVIDENCE_BYTES) {
      throw new BadRequestException({
        code: 'EVIDENCE_FILE_TOO_LARGE',
        message: 'El archivo no puede superar 10 MB',
      });
    }

    const ext = extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.test(ext)) {
      throw new BadRequestException({
        code: 'EVIDENCE_FILE_TYPE_INVALID',
        message: 'Solo se permiten PDF, JPG, JPEG o PNG',
      });
    }

    const justification = await this.loadJustificationOrFail(justificationId);
    await this.assertCanAttachEvidence(justification, actor);

    this.ensureUploadDir();
    const safeBase = (file.originalname || 'evidence').replace(/[^\w.-]+/g, '_').slice(0, 80);
    const filename = `${justificationId}-${Date.now()}-${safeBase}`;
    const absolutePath = join(this.uploadDir, filename);
    writeFileSync(absolutePath, file.buffer);

    if (!existsSync(absolutePath)) {
      throw new BadRequestException({
        code: 'EVIDENCE_STORE_FAILED',
        message: 'No se pudo guardar el archivo',
      });
    }

    const relativePath = `justifications/${filename}`;
    const evidence = this.evidences.create({
      justificationId: justification.id,
      fileName: file.originalname || filename,
      storagePath: relativePath,
      mimeType: file.mimetype,
      fileSizeBytes: file.buffer.length,
      uploadedByUserId: actor.id,
    });
    const saved = await this.evidences.save(evidence);
    return this.toEvidenceView(saved);
  }

  async getJustifications(
    filters: ListJustificationsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<JustificationListPageView> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(
      filters.pageSize ?? JUSTIFICATIONS_DEFAULT_PAGE_SIZE,
      JUSTIFICATIONS_MAX_PAGE_SIZE,
    );
    const qb = this.justifications
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.evidences', 'e')
      .innerJoinAndSelect('j.attendance', 'a')
      .innerJoinAndSelect('a.student', 'student')
      .innerJoinAndSelect('a.session', 'session')
      .innerJoinAndSelect('session.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.group', 'grp')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .orderBy('j.created_at', 'DESC');

    if (filters.status) {
      qb.andWhere('j.status = :status', { status: filters.status });
    }
    if (filters.studentUserId) {
      qb.andWhere('a.id_users_student = :studentUserId', {
        studentUserId: filters.studentUserId,
      });
    }
    if (filters.groupId) {
      qb.andWhere('ta.id_groups = :groupId', { groupId: filters.groupId });
    }
    if (filters.dateFrom) {
      qb.andWhere('session.session_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      qb.andWhere('session.session_date <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      qb.andWhere(
        `(CONCAT(student.name, ' ', student.first_lastname, ' ', IFNULL(student.second_lastname, '')) LIKE :q
          OR grp.name LIKE :q)`,
        { q },
      );
    }

    const canReview = this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW);
    const canViewAll = this.hasPermission(actor, PERMISSIONS.ATTENDANCE_READ) && canReview;
    if (!canViewAll && !canReview) {
      qb.andWhere('a.id_users_student = :actorId', { actorId: actor.id });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      data: rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Ausencias candidatas a justificación (WF-39): marcas ABSENT del actor
   * (o de sus representados / estudiante filtrado por revisor) sin
   * justificación activa. Espejo de la regla de creación: excluye
   * PENDING/APPROVED e incluye NONE/REJECTED para reintento.
   */
  async getJustifiableAbsences(
    filters: JustifiableAbsencesQueryDto,
    actor: AuthenticatedUser,
  ): Promise<JustifiableAbsenceView[]> {
    const canReview = this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW);
    let studentIds: number[];
    if (canReview && filters.studentUserId) {
      studentIds = [filters.studentUserId];
    } else {
      const represented = await this.getRepresentedStudentIds(actor.id);
      studentIds = [actor.id, ...represented];
    }

    const rows = await this.attendance
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.session', 'session')
      .innerJoinAndSelect('a.student', 'student')
      .innerJoinAndSelect('session.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.group', 'grp')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .where('a.status = :absent', { absent: AttendanceStatus.ABSENT })
      .andWhere('a.id_users_student IN (:...studentIds)', { studentIds })
      .andWhere('a.justification_status IN (:...justifiable)', {
        justifiable: [AttendanceJustificationStatus.NONE, AttendanceJustificationStatus.REJECTED],
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM absence_justifications j
          WHERE j.id_attendance = a.id_attendance
            AND j.status IN ('PENDING', 'APPROVED')
        )`,
      )
      .orderBy('session.session_date', 'DESC')
      .limit(100)
      .getMany();

    return rows.map((mark) => {
      const ta = mark.session?.teachingAssignment;
      return {
        attendanceId: mark.id,
        sessionDate: mark.session?.sessionDate ?? '',
        offeringName: this.resolveOfferingName(ta) ?? '',
        groupName: ta?.group?.name ?? '',
        studentFullName: mark.student ? formatUserFullName(mark.student) : '',
      };
    });
  }

  async reviewJustification(
    justificationId: number,
    dto: ReviewJustificationDto,
    actor: AuthenticatedUser,
  ): Promise<JustificationListItemView> {
    const justification = await this.loadJustificationOrFail(justificationId);

    if (justification.status !== JustificationStatus.PENDING) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_NOT_PENDING',
        message: 'Solo se pueden dictaminar justificaciones en estado PENDING',
      });
    }

    if (dto.status === JustificationReviewDecision.REJECTED) {
      const notes = dto.decisionNotes?.trim();
      if (!notes) {
        throw new BadRequestException({
          code: 'DECISION_NOTES_REQUIRED',
          message: 'Las notas de decisión son obligatorias al rechazar',
        });
      }
      justification.status = JustificationStatus.REJECTED;
      justification.decisionNotes = notes;
      justification.reviewedByUserId = actor.id;
      justification.reviewedAt = new Date();
      await this.justifications.save(justification);

      const mark = await this.attendance.findOneByOrFail({
        id: justification.attendanceId,
      });
      mark.justificationStatus = AttendanceJustificationStatus.REJECTED;
      // Keep AttendanceStatus.ABSENT unchanged.
      await this.attendance.save(mark);
    } else {
      justification.status = JustificationStatus.APPROVED;
      justification.decisionNotes = dto.decisionNotes?.trim() || null;
      justification.reviewedByUserId = actor.id;
      justification.reviewedAt = new Date();
      await this.justifications.save(justification);

      const mark = await this.attendance.findOneByOrFail({
        id: justification.attendanceId,
      });
      mark.justificationStatus = AttendanceJustificationStatus.JUSTIFIED;
      await this.attendance.save(mark);
    }

    return this.toView(await this.loadJustificationOrFail(justificationId));
  }

  private async assertCanAttachEvidence(
    justification: AbsenceJustification,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (justification.status !== JustificationStatus.PENDING) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_NOT_PENDING',
        message: 'Solo se pueden adjuntar evidencias a justificaciones pendientes',
      });
    }
    const canReview = this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW);
    const isCreator = justification.createdByUserId === actor.id;
    const isStudent = justification.attendance?.studentUserId === actor.id;
    const isRepresented =
      !canReview && !isCreator && !isStudent && justification.attendance
        ? await this.isMyRepresented(actor.id, justification.attendance.studentUserId)
        : false;
    if (!canReview && !isCreator && !isStudent && !isRepresented) {
      throw new ForbiddenException({
        code: 'EVIDENCE_NOT_ALLOWED',
        message: 'No puede adjuntar evidencia a esta justificación',
      });
    }
  }

  /**
   * True si existe vínculo Encargado → Estudiante registrado en
   * `guardian_student_links`. Una sola consulta; sin vínculo no hay acceso.
   */
  private async isMyRepresented(guardianUserId: number, studentUserId: number): Promise<boolean> {
    if (guardianUserId === studentUserId) return false;
    const count = await this.guardianLinks.count({
      where: { guardianUserId, studentUserId },
    });
    return count > 0;
  }

  /** Ids de estudiantes representados por el actor (vínculos registrados). */
  private async getRepresentedStudentIds(guardianUserId: number): Promise<number[]> {
    const rows = await this.guardianLinks.find({
      where: { guardianUserId },
      select: { studentUserId: true },
    });
    return rows.map((row) => row.studentUserId);
  }

  private async loadJustificationOrFail(id: number): Promise<AbsenceJustification> {
    const row = await this.justifications.findOne({
      where: { id },
      relations: {
        evidences: true,
        attendance: {
          student: true,
          session: {
            teachingAssignment: {
              group: true,
              subject: true,
              specialty: true,
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'JUSTIFICATION_NOT_FOUND',
        message: 'Justificación no encontrada',
      });
    }
    return row;
  }

  private toView(row: AbsenceJustification): JustificationListItemView {
    const attendance = row.attendance;
    const student = attendance?.student;
    const session = attendance?.session;
    const ta = session?.teachingAssignment;
    const offeringName = this.resolveOfferingName(ta);

    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      decisionNotes: row.decisionNotes ?? null,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt ?? null,
      reviewedByUserId: row.reviewedByUserId ?? null,
      attendanceId: row.attendanceId,
      sessionDate: session?.sessionDate ?? '',
      student: {
        userId: attendance?.studentUserId ?? 0,
        fullName: student ? formatUserFullName(student) : '',
        nationalId: student?.national_id ?? '',
      },
      group: {
        id: ta?.groupId ?? 0,
        name: ta?.group?.name ?? '',
      },
      offering: {
        name: offeringName ?? '',
        kind: ta?.offeringKind ?? null,
      },
      evidences: (row.evidences ?? []).map((e) => this.toEvidenceView(e)),
    };
  }

  private toEvidenceView(e: JustificationEvidence): JustificationEvidenceView {
    return {
      id: e.id,
      fileName: e.fileName,
      mimeType: e.mimeType,
      fileSizeBytes: e.fileSizeBytes,
      url: `/uploads/${e.storagePath.replace(/\\/g, '/')}`,
      uploadedByUserId: e.uploadedByUserId,
      createdAt: e.createdAt,
    };
  }

  private resolveOfferingName(
    ta:
      | {
          offeringKind?: AcademicOfferingKind | null;
          subject?: { name?: string } | null;
          specialty?: { name?: string } | null;
        }
      | undefined,
  ): string | null {
    if (!ta) return null;
    return (
      (ta.offeringKind === AcademicOfferingKind.SUBJECT ? ta.subject?.name : ta.specialty?.name) ??
      null
    );
  }

  private hasPermission(actor: AuthenticatedUser, code: string): boolean {
    return (actor.permissions ?? []).includes(code);
  }

  private ensureUploadDir(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}
