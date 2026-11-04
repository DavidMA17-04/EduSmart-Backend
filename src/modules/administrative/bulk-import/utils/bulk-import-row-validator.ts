import { UserStatus } from '../../../../common/enums/user-status.enum';
import {
  BulkImportBreakdownDto,
  ImportedUserRowDto,
  ResolvedGroupDto,
  RowValidationStatus,
  UserRoleEnum,
} from '../dto/bulk-import.dto';
import {
  BULK_IMPORT_NATIONAL_ID_ERROR,
  BULK_IMPORT_STUDENT_ONLY_ERROR,
  isStudentRoleValue,
  isValidBulkImportNationalId,
  parseUserStatus,
} from './bulk-import-normalizers';
import { SectionResolver } from './section-group-resolver';

/** Fila ya extraída (del archivo o del payload de confirmación). */
export type BulkImportRowInput = {
  row: number;
  tempId?: string;
  national_id: string;
  name: string;
  first_lastname: string;
  second_lastname: string;
  email: string;
  rawRole: string;
  rawUserStatus: string;
  section: string;
  phone: string;
};

export type ExistingUserKeys = {
  nationalIds: Set<string>;
  emails: Set<string>;
};

export type ValidatedImportRow = {
  record: ImportedUserRowDto;
  /** Errores de unicidad (archivo o BD) → 409 al confirmar. */
  hasDuplicateError: boolean;
  /** Errores de formato/obligatorios/rol/estado → 400 al confirmar. */
  hasInvalidError: boolean;
};

export type BulkImportValidationResult = {
  rows: ValidatedImportRow[];
  breakdown: BulkImportBreakdownDto;
  validCount: number;
  warningCount: number;
  errorCount: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateImportRows(
  inputs: BulkImportRowInput[],
  existing: ExistingUserKeys,
  resolveSection: SectionResolver,
): BulkImportValidationResult {
  const seenNationalIds = new Set<string>();
  const seenEmails = new Set<string>();
  const breakdown: BulkImportBreakdownDto = {
    duplicateNationalId: 0,
    duplicateEmail: 0,
    requiredFieldsMissing: 0,
    invalidEmail: 0,
    invalidRole: 0,
  };
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const rows = inputs.map((input) => {
    const { national_id, name, first_lastname, email, section, phone } = input;
    const effectiveRole = isStudentRoleValue(input.rawRole)
      ? UserRoleEnum.ESTUDIANTE
      : input.rawRole.trim().toUpperCase();

    const invalidFields: string[] = [];
    const errorMessages: string[] = [];
    const warningMessages: string[] = [];
    const observations: string[] = [];
    let hasDuplicateError = false;
    let hasInvalidError = false;

    const invalid = (field: string, message: string) => {
      invalidFields.push(field);
      errorMessages.push(message);
      hasInvalidError = true;
    };
    const duplicate = (field: string, message: string) => {
      invalidFields.push(field);
      errorMessages.push(message);
      hasDuplicateError = true;
    };

    if (!national_id) {
      invalid('national_id', 'La identificación (cédula) es obligatoria.');
      breakdown.requiredFieldsMissing++;
    } else {
      const idLower = national_id.toLowerCase();
      if (seenNationalIds.has(idLower)) {
        duplicate('national_id', `Cédula duplicada dentro del archivo (${national_id}).`);
        breakdown.duplicateNationalId++;
      } else {
        seenNationalIds.add(idLower);
      }
      if (existing.nationalIds.has(idLower)) {
        duplicate('national_id', `La cédula (${national_id}) ya existe en la base de datos.`);
        breakdown.duplicateNationalId++;
      }
      if (!isValidBulkImportNationalId(national_id)) {
        invalid('national_id', BULK_IMPORT_NATIONAL_ID_ERROR);
      }
    }

    if (!name) {
      invalid('name', 'El nombre es obligatorio.');
      breakdown.requiredFieldsMissing++;
    }

    if (!first_lastname) {
      invalid('first_lastname', 'El primer apellido es obligatorio.');
      breakdown.requiredFieldsMissing++;
    }

    if (!email) {
      invalid('email', 'El correo electrónico es obligatorio.');
      breakdown.requiredFieldsMissing++;
    } else {
      const emailLower = email.toLowerCase();
      if (!EMAIL_REGEX.test(emailLower)) {
        invalid('email', 'Formato de correo electrónico inválido.');
        breakdown.invalidEmail++;
      }
      if (seenEmails.has(emailLower)) {
        duplicate('email', `Correo electrónico duplicado dentro del archivo (${email}).`);
        breakdown.duplicateEmail++;
      } else {
        seenEmails.add(emailLower);
      }
      if (existing.emails.has(emailLower)) {
        duplicate('email', `El correo (${email}) ya se encuentra registrado en el sistema.`);
        breakdown.duplicateEmail++;
      }
    }

    if (!isStudentRoleValue(input.rawRole)) {
      invalid('role', BULK_IMPORT_STUDENT_ONLY_ERROR);
      breakdown.invalidRole++;
    }

    const userStatusResult = parseUserStatus(input.rawUserStatus);
    let user_status: UserStatus = UserStatus.ACTIVE;
    if (!userStatusResult.ok) {
      invalid('user_status', userStatusResult.error);
    } else {
      user_status = userStatusResult.value;
    }

    let resolvedGroup: ResolvedGroupDto | null = null;
    const resolution = resolveSection(section);
    if (resolution.kind === 'EMPTY') {
      if (effectiveRole === UserRoleEnum.ESTUDIANTE) {
        invalidFields.push('section');
        warningMessages.push('Estudiante sin sección académica asignada.');
        observations.push('Sin sección asignada');
      }
    } else if (resolution.kind === 'NOT_FOUND') {
      invalidFields.push('section');
      warningMessages.push(
        `Sección "${section}" no encontrada en un curso lectivo activo; se creará sin matrícula.`,
      );
    } else if (resolution.kind === 'AMBIGUOUS') {
      invalidFields.push('section');
      warningMessages.push(
        `Sección "${section}" ambigua: coincide con ${resolution.matches} grupos activos; se creará sin matrícula.`,
      );
    } else {
      resolvedGroup = {
        groupId: resolution.group.groupId,
        groupName: resolution.group.groupName,
        academicPeriodId: resolution.group.academicPeriodId,
        academicPeriodName: resolution.group.academicPeriodName,
      };
      if (user_status !== UserStatus.ACTIVE) {
        warningMessages.push(
          `El usuario no está activo; se creará sin matrícula en ${resolution.group.groupName}.`,
        );
      }
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

    const record: ImportedUserRowDto = {
      row: input.row,
      tempId: input.tempId,
      status,
      national_id,
      name,
      first_lastname,
      second_lastname: input.second_lastname || null,
      email,
      role: effectiveRole,
      section: section || null,
      phone: phone || null,
      user_status,
      resolvedGroup,
      observations: observations.length > 0 ? observations : ['Registro conforme'],
      invalidFields: invalidFields.length > 0 ? invalidFields : undefined,
      errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
      warningMessages: warningMessages.length > 0 ? warningMessages : undefined,
    };
    return { record, hasDuplicateError, hasInvalidError };
  });

  return { rows, breakdown, validCount, warningCount, errorCount };
}
