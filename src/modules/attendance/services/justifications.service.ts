import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join, resolve, sep } from 'path';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceJustificationStatus } from '../../../common/enums/attendance-justification-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Role } from '../../../common/enums/role.enum';
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
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { isInstitutionWideReviewer } from '../utils/attendance-actor.util';
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

export type JustificationEvidenceFile = {
  absolutePath: string;
  fileName: string;
  mimeType: string;
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    const savedId = await this.dataSource.transaction(async (manager) => {
      const justificationRepo = manager.getRepository(AbsenceJustification);
      const saved = await justificationRepo.save(
        justificationRepo.create({
          attendanceId: mark.id,
          reason: dto.reason.trim(),
          status: JustificationStatus.PENDING,
          createdByUserId: actor.id,
        }),
      );

      const previousJustificationStatus = mark.justificationStatus;
      mark.justificationStatus = AttendanceJustificationStatus.PENDING;
      await manager.getRepository(Attendance).save(mark);

      await this.audit(manager, actor, 'JUSTIFICATION_CREATED', saved.id, null, {
        attendanceId: mark.id,
        studentUserId: mark.studentUserId,
        status: JustificationStatus.PENDING,
        previousJustificationStatus,
      });
      return saved.id;
    });

    return this.toView(await this.loadJustificationOrFail(savedId));
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
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const evidenceRepo = manager.getRepository(JustificationEvidence);
        const row = await evidenceRepo.save(
          evidenceRepo.create({
            justificationId: justification.id,
            fileName: file.originalname || filename,
            storagePath: relativePath,
            mimeType: file.mimetype,
            fileSizeBytes: file.buffer.length,
            uploadedByUserId: actor.id,
          }),
        );
        await this.audit(manager, actor, 'JUSTIFICATION_EVIDENCE_UPLOADED', justification.id, null, {
          evidenceId: row.id,
          fileName: row.fileName,
          mimeType: row.mimeType,
          fileSizeBytes: row.fileSizeBytes,
        });
        return row;
      });
      return this.toEvidenceView(saved);
    } catch (error) {
      if (existsSync(absolutePath)) unlinkSync(absolutePath);
      throw error;
    }
  }

  /**
   * Archivo de evidencia para descarga autenticada. Aplica la misma
   * visibilidad que el listado; fuera de alcance responde 404.
   */
  async getEvidenceFile(
    justificationId: number,
    evidenceId: number,
    actor: AuthenticatedUser,
  ): Promise<JustificationEvidenceFile> {
    const notFound = () =>
      new NotFoundException({
        code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidencia no encontrada',
      });

    const justification = await this.justifications.findOne({
      where: { id: justificationId },
      relations: {
        evidences: true,
        attendance: { session: { teachingAssignment: true } },
      },
    });
    if (!justification || !(await this.canSeeJustification(actor, justification))) {
      throw notFound();
    }

    const evidence = (justification.evidences ?? []).find((e) => e.id === evidenceId);
    if (!evidence) throw notFound();

    const storageRoot = resolve(this.uploadDir, '..');
    const absolutePath = resolve(storageRoot, evidence.storagePath);
    if (!absolutePath.startsWith(this.uploadDir + sep) || !existsSync(absolutePath)) {
      throw notFound();
    }
    return {
      absolutePath,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
    };
  }

  async getJustifications(
    filters: ListJustificationsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<JustificationListPageView> {
    this.assertCanReadJustifications(actor);
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

    await this.applyJustificationScope(qb, actor);

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
    this.assertCanReadJustifications(actor);
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

    if (
      !isInstitutionWideReviewer(actor) &&
      justification.attendance?.session?.teachingAssignment?.userId !== actor.id
    ) {
      throw new ForbiddenException({
        code: 'JUSTIFICATION_REVIEW_NOT_ALLOWED',
        message: 'Solo puede dictaminar justificaciones de sus propias asignaciones docentes',
      });
    }

    if (justification.status !== JustificationStatus.PENDING) {
      throw new BadRequestException({
        code: 'JUSTIFICATION_NOT_PENDING',
        message: 'Solo se pueden dictaminar justificaciones en estado PENDING',
      });
    }

    const approve = dto.status !== JustificationReviewDecision.REJECTED;
    const notes = dto.decisionNotes?.trim() || null;
    if (!approve && !notes) {
      throw new BadRequestException({
        code: 'DECISION_NOTES_REQUIRED',
        message: 'Las notas de decisión son obligatorias al rechazar',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const attendanceRepo = manager.getRepository(Attendance);
      const mark = await attendanceRepo.findOneByOrFail({ id: justification.attendanceId });
      const before = {
        justificationStatus: justification.status,
        attendanceStatus: mark.status,
        attendanceJustificationStatus: mark.justificationStatus,
      };

      justification.status = approve ? JustificationStatus.APPROVED : JustificationStatus.REJECTED;
      justification.decisionNotes = notes;
      justification.reviewedByUserId = actor.id;
      justification.reviewedAt = new Date();
      await manager.getRepository(AbsenceJustification).save(justification);

      mark.status = approve ? AttendanceStatus.JUSTIFIED : AttendanceStatus.ABSENT;
      mark.justificationStatus = approve
        ? AttendanceJustificationStatus.JUSTIFIED
        : AttendanceJustificationStatus.REJECTED;
      mark.updatedByUserId = actor.id;
      await attendanceRepo.save(mark);

      await this.audit(
        manager,
        actor,
        approve ? 'JUSTIFICATION_APPROVED' : 'JUSTIFICATION_REJECTED',
        justification.id,
        before,
        {
          justificationStatus: justification.status,
          attendanceId: mark.id,
          attendanceStatus: mark.status,
          attendanceJustificationStatus: mark.justificationStatus,
          decisionNotes: notes,
        },
      );
    });

    return this.toView(await this.loadJustificationOrFail(justificationId));
  }

  /**
   * Visibilidad por actor: Admin todo; otro revisor solo sesiones
   * de sus asignaciones docentes; el resto, propias y de representados.
   */
  private async applyJustificationScope(
    qb: SelectQueryBuilder<AbsenceJustification>,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (isInstitutionWideReviewer(actor)) return;
    if (this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW)) {
      qb.andWhere('ta.id_users = :scopeTeacherId', { scopeTeacherId: actor.id });
      return;
    }
    const represented = await this.getRepresentedStudentIds(actor.id);
    qb.andWhere('a.id_users_student IN (:...scopeStudentIds)', {
      scopeStudentIds: [actor.id, ...represented],
    });
  }

  private async canSeeJustification(
    actor: AuthenticatedUser,
    justification: AbsenceJustification,
  ): Promise<boolean> {
    if (isInstitutionWideReviewer(actor)) return true;
    const attendance = justification.attendance;
    if (!attendance) return false;
    if (this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW)) {
      return attendance.session?.teachingAssignment?.userId === actor.id;
    }
    if (attendance.studentUserId === actor.id) return true;
    return this.isMyRepresented(actor.id, attendance.studentUserId);
  }

  private async audit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    action: string,
    justificationId: number,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
  ): Promise<void> {
    const repo = manager.getRepository(AuditLog);
    await repo.save(
      repo.create({
        actorId: actor.id,
        action,
        entity: 'AbsenceJustification',
        entityId: String(justificationId),
        before,
        after,
      }),
    );
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
      url: `/attendance/justifications/${e.justificationId}/evidence/${e.id}`,
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

  /** OR rule (view | justify | review): the guard only supports AND. */
  private assertCanReadJustifications(actor: AuthenticatedUser): void {
    if ((actor.roles ?? []).includes(Role.ADMIN)) return;
    const allowed = [
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.ATTENDANCE_JUSTIFY,
      PERMISSIONS.ATTENDANCE_REVIEW,
    ].some((code) => this.hasPermission(actor, code));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Missing permission to read justifications',
      });
    }
  }

  private ensureUploadDir(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }
}
