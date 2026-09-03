import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { RoleEntity } from '../../roles/entities/role.entity';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { User } from '../../users/entities/user.entity';
import { UserRoleEntity } from '../../users/entities/user-role.entity';
import { UsersRepository } from '../../users/repositories/users.repository';
import {
  BulkImportBreakdownDto,
  BulkImportDto,
  ConfirmBulkImportDto,
  ConfirmBulkImportResponseDto,
  ImportedUserRowDto,
  KPISummaryDto,
  RowValidationStatus,
  UserRoleEnum,
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
  BULK_IMPORT_NATIONAL_ID_ERROR,
  BULK_IMPORT_STUDENT_ONLY_ERROR,
  BULK_IMPORT_STUDENT_ROLE_MISSING,
  isStudentRoleValue,
  isValidBulkImportNationalId,
  normalizeTextKey,
  parseUserStatus,
  pickFirstValue,
} from '../utils/bulk-import-normalizers';

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
  ) {}

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

  async validateBulkFile(fileBuffer: Buffer): Promise<ValidateBulkImportResponseDto> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Debe adjuntar un archivo válido (.xlsx, .xls o .csv).');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('El archivo cargado se encuentra vacío.');
    }

    const existingUsers = await this.usersRepository.findAll();
    const dbNationalIds = new Set<string>(
      existingUsers
        .map((u) => (u.nationalId ?? (u as any).national_id)?.trim().toLowerCase())
        .filter((id): id is string => Boolean(id)),
    );
    const dbEmails = new Set<string>(
      existingUsers
        .map((u) => u.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );

    await this.requireStudentRole();

    const seenFileNationalIds = new Set<string>();
    const seenFileEmails = new Set<string>();

    const records: ImportedUserRowDto[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const breakdown: BulkImportBreakdownDto = {
      duplicateNationalId: 0,
      duplicateEmail: 0,
      requiredFieldsMissing: 0,
      invalidEmail: 0,
      invalidRole: 0,
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rawRows.forEach((raw, index) => {
      const row = index + 1;
      const normalizedRow: Record<string, string> = {};

      Object.entries(raw).forEach(([k, v]) => {
        normalizedRow[this.normalizeKey(k)] = String(v).trim();
      });

      const national_id =
        normalizedRow['identificacion'] ||
        normalizedRow['cedula'] ||
        normalizedRow['id'] ||
        normalizedRow['national_id'] ||
        '';

      const name =
        normalizedRow['nombres'] ||
        normalizedRow['nombre'] ||
        normalizedRow['name'] ||
        normalizedRow['first_name'] ||
        '';

      const first_lastname = pickFirstValue(normalizedRow, [
        'apellido1',
        'apellido_1',
        'primer_apellido',
        'primerapellido',
        'apellidos',
        'first_lastname',
      ]);

      const second_lastname = pickFirstValue(normalizedRow, [
        'apellido2',
        'apellido_2',
        'segundo_apellido',
        'segundoapellido',
        'second_lastname',
      ]);

      const email =
        normalizedRow['correo'] ||
        normalizedRow['email'] ||
        normalizedRow['correo_institucional'] ||
        '';

      const rawRole = normalizedRow['rol'] || normalizedRow['role'] || '';
      const effectiveRole = isStudentRoleValue(rawRole)
        ? UserRoleEnum.ESTUDIANTE
        : rawRole.trim().toUpperCase();

      const rawUserStatus = normalizedRow['estado'] || normalizedRow['status'] || '';

      const section =
        normalizedRow['seccion'] ||
        normalizedRow['seccion_academica'] ||
        normalizedRow['section'] ||
        '';

      const phone =
        normalizedRow['telefono'] ||
        normalizedRow['celular'] ||
        normalizedRow['phone'] ||
        '';

      const invalidFields: string[] = [];
      const errorMessages: string[] = [];
      const warningMessages: string[] = [];
      const observations: string[] = [];

      if (!national_id) {
        invalidFields.push('national_id');
        errorMessages.push('La identificación (cédula) es obligatoria.');
        breakdown.requiredFieldsMissing++;
      } else {
        const idLower = national_id.toLowerCase();
        if (seenFileNationalIds.has(idLower)) {
          invalidFields.push('national_id');
          errorMessages.push(`Cédula duplicada dentro del archivo (${national_id}).`);
          breakdown.duplicateNationalId++;
        } else {
          seenFileNationalIds.add(idLower);
        }

        if (dbNationalIds.has(idLower)) {
          invalidFields.push('national_id');
          errorMessages.push(`La cédula (${national_id}) ya existe en la base de datos.`);
          breakdown.duplicateNationalId++;
        }

        if (!isValidBulkImportNationalId(national_id)) {
          invalidFields.push('national_id');
          errorMessages.push(BULK_IMPORT_NATIONAL_ID_ERROR);
        }
      }

      if (!name) {
        invalidFields.push('name');
        errorMessages.push('El nombre es obligatorio.');
        breakdown.requiredFieldsMissing++;
      }

      if (!first_lastname) {
        invalidFields.push('first_lastname');
        errorMessages.push('El primer apellido es obligatorio.');
        breakdown.requiredFieldsMissing++;
      }

      if (!email) {
        invalidFields.push('email');
        errorMessages.push('El correo electrónico es obligatorio.');
        breakdown.requiredFieldsMissing++;
      } else {
        const emailLower = email.toLowerCase();
        if (!emailRegex.test(emailLower)) {
          invalidFields.push('email');
          errorMessages.push('Formato de correo electrónico inválido.');
          breakdown.invalidEmail++;
        }

        if (seenFileEmails.has(emailLower)) {
          invalidFields.push('email');
          errorMessages.push(`Correo electrónico duplicado dentro del archivo (${email}).`);
          breakdown.duplicateEmail++;
        } else {
          seenFileEmails.add(emailLower);
        }

        if (dbEmails.has(emailLower)) {
          invalidFields.push('email');
          errorMessages.push(`El correo (${email}) ya se encuentra registrado en el sistema.`);
          breakdown.duplicateEmail++;
        }
      }

      if (!isStudentRoleValue(rawRole)) {
        invalidFields.push('role');
        errorMessages.push(BULK_IMPORT_STUDENT_ONLY_ERROR);
        breakdown.invalidRole++;
      }

      const userStatusResult = parseUserStatus(rawUserStatus);
      let user_status: UserStatus = UserStatus.ACTIVE;
      if (!userStatusResult.ok) {
        invalidFields.push('user_status');
        errorMessages.push(userStatusResult.error);
      } else {
        user_status = userStatusResult.value;
      }

      if (!section && effectiveRole === UserRoleEnum.ESTUDIANTE) {
        invalidFields.push('section');
        warningMessages.push('Estudiante sin sección académica asignada.');
        observations.push('Sin sección asignada');
      }

      if (phone && phone.replace(/\D/g, '').length < 8) {
        invalidFields.push('phone');
        warningMessages.push('Número de teléfono parece incompleto.');
        observations.push('Teléfono incompleto');
      }

      let status: RowValidationStatus = 'VALID';
      if (errorMessages.length > 0) {
        status = 'ERROR';
        errorCount++;
        observations.push(...errorMessages);
      } else if (warningMessages.length > 0) {
        status = 'WARNING';
        warningCount++;
      } else {
        validCount++;
        observations.push('Registro conforme');
      }

      records.push({
        row,
        tempId: `tmp-${row}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        status,
        national_id,
        name,
        first_lastname,
        second_lastname: second_lastname || null,
        email,
        role: effectiveRole,
        section: section || null,
        phone: phone || null,
        user_status,
        observations: observations.length > 0 ? observations : ['Registro conforme'],
        invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
        errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
        warningMessages: warningMessages.length > 0 ? warningMessages : undefined,
      });
    });

    const total = records.length;
    const validPercentage = total > 0 ? Number(((validCount / total) * 100).toFixed(1)) : 0;
    const warningsPercentage = total > 0 ? Number(((warningCount / total) * 100).toFixed(1)) : 0;
    const errorsPercentage = total > 0 ? Number(((errorCount / total) * 100).toFixed(1)) : 0;

    const kpis: KPISummaryDto = {
      totalRows: total,
      validRows: validCount,
      validPercentage,
      warningRows: warningCount,
      warningPercentage: warningsPercentage,
      errorRows: errorCount,
      errorPercentage: errorsPercentage,
    };

    return {
      total,
      valid: validCount,
      validPercentage,
      warnings: warningCount,
      warningsPercentage,
      errors: errorCount,
      errorsPercentage,
      breakdown,
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

  async executeBulkImport(
    validRecords: ImportedUserRowDto[],
  ): Promise<ConfirmBulkImportResponseDto> {
    if (!validRecords || validRecords.length === 0) {
      throw new BadRequestException('No se recibieron usuarios para importar.');
    }

    const studentRole = await this.requireStudentRole();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const defaultPasswordHash = await bcrypt.hash('EduSmart2026*', 10);
      let insertedCount = 0;

      for (const record of validRecords) {
        if (!isStudentRoleValue(record.role || '')) {
          throw new BadRequestException(BULK_IMPORT_STUDENT_ONLY_ERROR);
        }

        const user = queryRunner.manager.create(User, {
          national_id: record.national_id.trim(),
          name: record.name.trim(),
          first_lastname: record.first_lastname.trim(),
          second_lastname: record.second_lastname ? record.second_lastname.trim() : null,
          email: record.email.trim().toLowerCase(),
          phone: record.phone ? record.phone.trim() : null,
          password_hash: defaultPasswordHash,
          status: record.user_status ?? UserStatus.ACTIVE,
          mustChangePassword: true,
          lastLoginAt: null,
        });

        const savedUser = await queryRunner.manager.save(user);

        const userRole = queryRunner.manager.create(UserRoleEntity, {
          userId: savedUser.id,
          roleId: studentRole.id,
        });
        await queryRunner.manager.save(userRole);

        insertedCount++;
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Importación masiva completada: ${insertedCount} usuarios guardados en MySQL con user_roles.`,
      );

      return {
        importedCount: insertedCount,
        message: `Se han importado ${insertedCount} usuario(s) exitosamente en la base de datos.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error durante la transacción de importación masiva. Se ejecutó Rollback.',
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ocurrió un error al persistir el lote de usuarios en MySQL. La transacción fue revertida en su totalidad.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async confirmImport(dto: ConfirmBulkImportDto): Promise<ConfirmBulkImportResponseDto> {
    const list = dto.validRecords ?? dto.users ?? [];
    return this.executeBulkImport(list);
  }

  importData(_dto: BulkImportDto) {
    throw new NotImplementedException('Carga masiva pendiente de implementar');
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
