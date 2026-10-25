import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import * as XLSX from 'xlsx';
import { GroupStatus } from '../../../../common/enums/group-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { MailService } from '../../../../integrations/mail/mail.service';
import { tryLoadInstitutionLogoAttachment } from '../../../../integrations/mail/optional-logo.attachment';
import { buildWelcomeCredentialsMail } from '../../../../integrations/mail/templates/welcome-credentials.mail';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { AcademicPeriodStatus } from '../../academic-periods/enums/academic-period-status.enum';
import { GroupEnrollmentsService } from '../../group-enrollments/services/group-enrollments.service';
import { RoleEntity } from '../../roles/entities/role.entity';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { GroupEntity } from '../../sections/entities/group.entity';
import { AuditLog } from '../../users/entities/audit-log.entity';
import { User } from '../../users/entities/user.entity';
import { UserRoleEntity } from '../../users/entities/user-role.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import {
  BulkImportRejectedRowDto,
  ConfirmBulkImportDto,
  ConfirmBulkImportResponseDto,
  ImportedUserRowDto,
  KPISummaryDto,
  NotEnrolledRowDto,
  ValidateBulkImportResponseDto,
} from '../dto/bulk-import.dto';
import { ImportSummaryDto } from '../dto/import-summary.dto';
import { RegisterImportResultDto } from '../dto/register-import-result.dto';
import { ImportBatch } from '../entities/import-batch.entity';
import { ImportRecord } from '../entities/import-record.entity';
import { ImportRecordStatus } from '../enums/import-record-status.enum';
import { ImportResult } from '../interfaces/import-result.interface';
import { ImportBatchesRepository } from '../repositories/import-batches.repository';
import {
  BULK_IMPORT_STUDENT_ROLE_MISSING,
  normalizeTextKey,
  pickFirstValue,
} from '../utils/bulk-import-normalizers';
import {
  BulkImportRowInput,
  ExistingUserKeys,
  validateImportRows,
} from '../utils/bulk-import-row-validator';
import {
  ActiveGroupCandidate,
  SectionResolver,
  buildSectionResolver,
  enrollmentStartDate,
} from '../utils/section-group-resolver';

type PendingWelcomeCredential = {
  email: string;
  fullName: string;
  temporaryPassword: string;
};

const REQUIRED_HEADER_GROUPS: Array<{ label: string; aliases: string[] }> = [
  { label: 'identificacion', aliases: ['identificacion', 'cedula', 'national_id'] },
  { label: 'nombres', aliases: ['nombres', 'nombre', 'name'] },
  {
    label: 'primer_apellido',
    aliases: ['primer_apellido', 'first_lastname', 'apellidos', 'apellido1', 'apellido_1'],
  },
  { label: 'correo', aliases: ['correo', 'email'] },
];

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly dataSource: DataSource,
    private readonly importBatchesRepository: ImportBatchesRepository,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly groupEnrollments: GroupEnrollmentsService,
  ) {}

  /** Contraseña temporal criptográficamente segura (PO-02-03). */
  generateTemporaryPassword(): string {
    return randomBytes(8).toString('base64url');
  }

  private normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /** Resuelve el rol ESTUDIANTE/Estudiante desde MySQL o falla. */
  private async requireStudentRole(): Promise<RoleEntity> {
    const roles = await this.rolesRepository.findAll();
    const student =
      roles.find((role) => normalizeTextKey(role.name) === 'estudiante') ??
      roles.find((role) => normalizeTextKey(role.name) === 'student') ??
      null;

    if (!student) {
      throw new BadRequestException(BULK_IMPORT_STUDENT_ROLE_MISSING);
    }
    return student;
  }

  private assertRequiredHeaders(worksheet: XLSX.WorkSheet): void {
    const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(worksheet, {
      header: 1,
      defval: '',
    });
    const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? ''));
    const normalizedHeaders = new Set(
      headerRow.map((h) => this.normalizeKey(h)).filter((h) => Boolean(h)),
    );

    const missing = REQUIRED_HEADER_GROUPS.filter(
      (group) => !group.aliases.some((alias) => normalizedHeaders.has(alias)),
    ).map((group) => group.label);

    if (missing.length > 0) {
      throw new BadRequestException(
        `El archivo no contiene la estructura requerida. Faltan las siguientes columnas: ${missing.join(', ')}`,
      );
    }
  }

  private toRowInput(raw: Record<string, unknown>, index: number): BulkImportRowInput {
    const row = index + 1;
    const normalizedRow: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      normalizedRow[this.normalizeKey(k)] = String(v).trim();
    });

    return {
      row,
      tempId: `tmp-${row}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      national_id:
        normalizedRow['identificacion'] ||
        normalizedRow['cedula'] ||
        normalizedRow['id'] ||
        normalizedRow['national_id'] ||
        '',
      name:
        normalizedRow['nombres'] ||
        normalizedRow['nombre'] ||
        normalizedRow['name'] ||
        normalizedRow['first_name'] ||
        '',
      first_lastname: pickFirstValue(normalizedRow, [
        'apellido1',
        'apellido_1',
        'primer_apellido',
        'primerapellido',
        'apellidos',
        'first_lastname',
      ]),
      second_lastname: pickFirstValue(normalizedRow, [
        'apellido2',
        'apellido_2',
        'segundo_apellido',
        'segundoapellido',
        'second_lastname',
      ]),
      email:
        normalizedRow['correo'] ||
        normalizedRow['email'] ||
        normalizedRow['correo_institucional'] ||
        '',
      rawRole: normalizedRow['rol'] || normalizedRow['role'] || '',
      rawUserStatus: normalizedRow['estado'] || normalizedRow['status'] || '',
      section:
        normalizedRow['seccion'] ||
        normalizedRow['seccion_academica'] ||
        normalizedRow['section'] ||
        '',
      phone: normalizedRow['telefono'] || normalizedRow['celular'] || normalizedRow['phone'] || '',
    };
  }

  private recordToRowInput(record: ImportedUserRowDto, index: number): BulkImportRowInput {
    const text = (value: unknown) => (value == null ? '' : String(value).trim());
    return {
      row: Number(record.row) || index + 1,
      national_id: text(record.national_id),
      name: text(record.name),
      first_lastname: text(record.first_lastname),
      second_lastname: text(record.second_lastname),
      email: text(record.email),
      rawRole: text(record.role),
      rawUserStatus: text(record.user_status),
      section: text(record.section),
      phone: text(record.phone),
    };
  }

  private async loadExistingKeys(inputs: BulkImportRowInput[]): Promise<ExistingUserKeys> {
    const nationalIds = [...new Set(inputs.map((r) => r.national_id).filter(Boolean))];
    const emails = [...new Set(inputs.map((r) => r.email.toLowerCase()).filter(Boolean))];
    const users = await this.usersRepository.findByNationalIdsOrEmails(nationalIds, emails);
    return {
      nationalIds: new Set(
        users.map((u) => u.national_id?.trim().toLowerCase()).filter((v): v is string => !!v),
      ),
      emails: new Set(
        users.map((u) => u.email?.trim().toLowerCase()).filter((v): v is string => !!v),
      ),
    };
  }

  /** Grupos activos de cursos lectivos activos, para resolver la columna sección. */
  private async loadSectionResolver(): Promise<SectionResolver> {
    const groups = await this.dataSource
      .getRepository(GroupEntity)
      .createQueryBuilder('g')
      .innerJoinAndSelect('g.academicPeriod', 'p')
      .where('g.status = :groupStatus', { groupStatus: GroupStatus.ACTIVE })
      .andWhere('p.status = :periodStatus', { periodStatus: AcademicPeriodStatus.ACTIVE })
      .getMany();

    const candidates: ActiveGroupCandidate[] = groups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      academicPeriodId: g.academicPeriodId,
      academicPeriodName: g.academicPeriod?.name ?? '',
      periodStartDate: g.academicPeriod?.startDate ?? '',
    }));
    return buildSectionResolver(candidates);
  }

  async validateBulkFile(fileBuffer: Buffer): Promise<ValidateBulkImportResponseDto> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Debe adjuntar un archivo válido (.xlsx, .xls o .csv).');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 });
    } catch (error) {
      this.logger.error('Error al leer el archivo Excel/CSV', error);
      throw new BadRequestException(
        'El archivo proporcionado está dañado o no tiene un formato Excel/CSV válido.',
      );
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    this.assertRequiredHeaders(worksheet);

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('El archivo cargado se encuentra vacío.');
    }

    await this.requireStudentRole();

    const inputs = rawRows.map((raw, index) => this.toRowInput(raw, index));
    const [existing, resolveSection] = await Promise.all([
      this.loadExistingKeys(inputs),
      this.loadSectionResolver(),
    ]);
    const result = validateImportRows(inputs, existing, resolveSection);
    const records = result.rows.map((r) => r.record);

    const total = records.length;
    const pct = (count: number) =>
      total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    const validPercentage = pct(result.validCount);
    const warningsPercentage = pct(result.warningCount);
    const errorsPercentage = pct(result.errorCount);

    const kpis: KPISummaryDto = {
      totalRows: total,
      validRows: result.validCount,
      validPercentage,
      warningRows: result.warningCount,
      warningPercentage: warningsPercentage,
      errorRows: result.errorCount,
      errorPercentage: errorsPercentage,
    };

    return {
      total,
      valid: result.validCount,
      validPercentage,
      warnings: result.warningCount,
      warningsPercentage,
      errors: result.errorCount,
      errorsPercentage,
      breakdown: result.breakdown,
      records,
      kpis,
      rows: records,
    };
  }

  async validateFile(file?: Express.Multer.File): Promise<ValidateBulkImportResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Debe adjuntar un archivo válido (.xlsx, .xls o .csv).');
    }
    return this.validateBulkFile(file.buffer);
  }

  /**
   * Inserta el lote tras revalidarlo en el servidor (no confía en el estado
   * enviado por el cliente). Usuarios, roles, matrículas y auditoría van en
   * una sola transacción; los correos se envían solo después del commit.
   */
  async executeBulkImport(
    validRecords: ImportedUserRowDto[],
    actor?: AuthenticatedUser,
  ): Promise<ConfirmBulkImportResponseDto> {
    if (!validRecords || validRecords.length === 0) {
      throw new BadRequestException('No se recibieron usuarios para importar.');
    }

    const studentRole = await this.requireStudentRole();

    const inputs = validRecords.map((record, index) => this.recordToRowInput(record, index));
    const [existing, resolveSection] = await Promise.all([
      this.loadExistingKeys(inputs),
      this.loadSectionResolver(),
    ]);
    const validation = validateImportRows(inputs, existing, resolveSection);
    this.assertBatchAccepted(validation.rows);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const pendingCredentials: PendingWelcomeCredential[] = [];
    const notEnrolled: NotEnrolledRowDto[] = [];
    let enrolledCount = 0;

    try {
      const manager = queryRunner.manager;
      const enrollmentsByGroup = new Map<
        number,
        { group: ActiveGroupCandidate; userIds: number[] }
      >();
      const auditRows: Array<{ userId: number; email: string; groupId: number | null }> = [];

      for (const { record } of validation.rows) {
        const temporaryPassword = this.generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        const email = record.email.trim().toLowerCase();
        const name = record.name.trim();
        const firstLastname = record.first_lastname.trim();
        const secondLastname = record.second_lastname ? record.second_lastname.trim() : null;
        const fullName = [name, firstLastname, secondLastname].filter(Boolean).join(' ');
        const userStatus = record.user_status ?? UserStatus.ACTIVE;

        const user = manager.create(User, {
          national_id: record.national_id.trim(),
          name,
          first_lastname: firstLastname,
          second_lastname: secondLastname,
          email,
          phone: record.phone ? record.phone.trim() : null,
          password_hash: passwordHash,
          status: userStatus,
          mustChangePassword: true,
          lastLoginAt: null,
        });
        const savedUser = await manager.save(user);

        await manager.save(
          manager.create(UserRoleEntity, {
            userId: savedUser.id,
            roleId: studentRole.id,
          }),
        );

        const resolution = resolveSection(record.section);
        let groupId: number | null = null;
        if (resolution.kind === 'RESOLVED' && userStatus === UserStatus.ACTIVE) {
          groupId = resolution.group.groupId;
          const bucket = enrollmentsByGroup.get(groupId) ?? {
            group: resolution.group,
            userIds: [],
          };
          bucket.userIds.push(savedUser.id);
          enrollmentsByGroup.set(groupId, bucket);
        } else {
          notEnrolled.push({
            row: record.row ?? 0,
            email,
            reason: this.notEnrolledReason(resolution.kind, record.section ?? ''),
          });
        }

        auditRows.push({ userId: savedUser.id, email, groupId });
        pendingCredentials.push({ email, fullName, temporaryPassword });
      }

      for (const { group, userIds } of enrollmentsByGroup.values()) {
        await this.groupEnrollments.enrollNewStudentsInTransaction(manager, {
          groupId: group.groupId,
          academicPeriodId: group.academicPeriodId,
          userIds,
          startsOn: enrollmentStartDate(group.periodStartDate),
        });
        enrolledCount += userIds.length;
      }

      const auditRepo = manager.getRepository(AuditLog);
      await auditRepo.save(
        auditRows.map((row) =>
          auditRepo.create({
            actorId: actor?.id ?? null,
            action: 'USER_CREATED',
            entity: 'User',
            entityId: String(row.userId),
            before: null,
            after: {
              source: 'BULK_IMPORT',
              email: row.email,
              groupId: row.groupId,
            },
          }),
        ),
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Importación masiva completada: ${pendingCredentials.length} usuarios, ${enrolledCount} matriculados.`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error durante la transacción de importación masiva. Se ejecutó Rollback.',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException({
          code: 'BULK_IMPORT_DUPLICATE',
          message:
            'Otro usuario con la misma cédula o correo se registró durante la importación. No se importó ningún registro; vuelva a validar el archivo.',
        });
      }
      throw new InternalServerErrorException(
        'Ocurrió un error al persistir el lote de usuarios en MySQL. La transacción fue revertida en su totalidad.',
      );
    } finally {
      await queryRunner.release();
    }

    await this.dispatchWelcomeCredentials(pendingCredentials);

    const importedCount = pendingCredentials.length;
    return {
      importedCount,
      enrolledCount,
      notEnrolled,
      message: `Se han importado ${importedCount} usuario(s) y matriculado ${enrolledCount} en su sección.`,
    };
  }

  /** 400 si hay errores de formato/obligatorios; 409 si solo hay duplicados. */
  private assertBatchAccepted(
    rows: Array<{ record: ImportedUserRowDto; hasDuplicateError: boolean; hasInvalidError: boolean }>,
  ): void {
    const rejected = rows.filter((r) => r.hasDuplicateError || r.hasInvalidError);
    if (rejected.length === 0) return;

    const detail: BulkImportRejectedRowDto[] = rejected.map(({ record }) => ({
      row: record.row ?? 0,
      invalidFields: record.invalidFields ?? [],
      errorMessages: record.errorMessages ?? [],
    }));

    if (rejected.some((r) => r.hasInvalidError)) {
      throw new BadRequestException({
        code: 'BULK_IMPORT_INVALID_ROWS',
        message: `El lote tiene ${rejected.length} registro(s) inválido(s). No se importó ningún usuario.`,
        rows: detail,
      });
    }
    throw new ConflictException({
      code: 'BULK_IMPORT_DUPLICATE',
      message: `El lote tiene ${rejected.length} registro(s) con cédula o correo duplicado. No se importó ningún usuario.`,
      rows: detail,
    });
  }

  private notEnrolledReason(kind: string, section: string): string {
    if (kind === 'NOT_FOUND') {
      return `Sección "${section}" no encontrada en un curso lectivo activo.`;
    }
    if (kind === 'AMBIGUOUS') {
      return `Sección "${section}" ambigua: coincide con varios grupos activos.`;
    }
    if (kind === 'RESOLVED') {
      return 'Usuario no activo: se creó sin matrícula.';
    }
    return 'Sin sección asignada.';
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (error as QueryFailedError & { driverError?: { code?: string } })
      .driverError;
    return driverError?.code === 'ER_DUP_ENTRY';
  }

  private publicAppUrl(): string {
    return (
      this.configService.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173'
    );
  }

  /**
   * Envía correos de bienvenida tras el commit. Fallos SMTP no revierten usuarios.
   */
  private async dispatchWelcomeCredentials(
    credentials: PendingWelcomeCredential[],
  ): Promise<void> {
    if (credentials.length === 0) {
      return;
    }

    const loginUrl = `${this.publicAppUrl()}/login`;
    const logo = tryLoadInstitutionLogoAttachment();

    for (const item of credentials) {
      try {
        const mail = buildWelcomeCredentialsMail({
          email: item.email,
          fullName: item.fullName,
          temporaryPassword: item.temporaryPassword,
          loginUrl,
          includeLogo: Boolean(logo),
        });
        await this.mailService.sendMail({
          to: item.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          ...(logo ? { attachments: [logo] } : {}),
        });
      } catch (error) {
        this.logger.warn(
          `No se pudo enviar correo de credenciales a ${item.email} (usuario ya creado).`,
        );
        this.logger.debug(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async confirmImport(
    dto: ConfirmBulkImportDto,
    actor?: AuthenticatedUser,
  ): Promise<ConfirmBulkImportResponseDto> {
    const list = dto.validRecords ?? dto.users ?? [];
    return this.executeBulkImport(list, actor);
  }

  async registerResult(dto: RegisterImportResultDto): Promise<ImportResult> {
    const summary = this.resolveSummary(dto);
    const records: Partial<ImportRecord>[] = [
      ...dto.successfulRecords.map((item) => ({
        rowNumber: item.rowNumber,
        status: ImportRecordStatus.SUCCESS,
        payload: item as unknown as Record<string, unknown>,
      })),
      ...dto.errorRecords.map((item) => ({
        rowNumber: item.rowNumber,
        status: ImportRecordStatus.ERROR,
        payload: item as unknown as Record<string, unknown>,
        errorMessage: item.message,
      })),
    ];

    const batch = this.importBatchesRepository.create({
      type: dto.type?.trim() || 'users',
      summary: summary as unknown as Record<string, number>,
      records: records as ImportRecord[],
    });
    const saved = await this.importBatchesRepository.save(batch);
    const persisted = (await this.importBatchesRepository.findById(saved.id)) ?? saved;
    return this.toResult(persisted);
  }

  async findResult(jobId: number): Promise<ImportResult> {
    const batch = await this.importBatchesRepository.findById(jobId);
    if (!batch) {
      throw new NotFoundException(`Import batch ${jobId} not found`);
    }
    return this.toResult(batch);
  }

  private resolveSummary(dto: RegisterImportResultDto): ImportSummaryDto {
    const successfulRecords = dto.successfulRecords.length;
    const errorRecords = dto.errorRecords.length;
    return {
      totalRecords: dto.summary?.totalRecords ?? successfulRecords + errorRecords,
      successfulRecords: dto.summary?.successfulRecords ?? successfulRecords,
      errorRecords: dto.summary?.errorRecords ?? errorRecords,
    };
  }

  private toResult(batch: ImportBatch): ImportResult {
    const records = batch.records ?? [];
    return {
      jobId: batch.id,
      type: batch.type,
      successfulRecords: records
        .filter((record) => record.status === ImportRecordStatus.SUCCESS)
        .map((record) => (record.payload ?? { rowNumber: record.rowNumber }) as never),
      errorRecords: records
        .filter((record) => record.status === ImportRecordStatus.ERROR)
        .map(
          (record) =>
            (record.payload ?? {
              rowNumber: record.rowNumber,
              message: record.errorMessage ?? 'Error de importación',
            }) as never,
        ),
      summary: (batch.summary ??
        this.resolveSummary({
          successfulRecords: [],
          errorRecords: [],
        })) as ImportSummaryDto,
    };
  }
}
