import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Traduce los mensajes por defecto de class-validator (en inglés) a español
 * legible para el usuario final. Los mensajes personalizados de los DTO
 * (`{ message: '...' }`) se respetan tal cual.
 */

/** Nombre visible de los campos más comunes de los DTO. */
const FIELD_LABELS: Record<string, string> = {
  academicPeriodId: 'periodo académico',
  academicYearId: 'año lectivo',
  action: 'acción',
  active: 'activo',
  body: 'contenido',
  caseId: 'expediente',
  code: 'código',
  content: 'contenido',
  courseId: 'curso',
  currentPassword: 'contraseña actual',
  date: 'fecha',
  dateFrom: 'fecha inicial',
  dateTo: 'fecha final',
  day: 'día',
  dayOfWeek: 'día de la semana',
  days: 'días',
  deactivationReason: 'motivo de desactivación',
  deadline: 'fecha límite',
  decision: 'decisión',
  decisionNotes: 'notas de la decisión',
  departmentId: 'departamento',
  departureTime: 'hora de salida',
  departureType: 'tipo de salida',
  description: 'descripción',
  detail: 'detalle',
  displayOrder: 'orden',
  document: 'documento',
  email: 'correo electrónico',
  endDate: 'fecha de fin',
  endTime: 'hora de fin',
  endsOn: 'fecha de fin',
  expirationDate: 'fecha de vencimiento',
  firstLastname: 'primer apellido',
  firstName: 'nombre',
  from: 'desde',
  gradeLevel: 'nivel',
  groupId: 'grupo',
  groupIds: 'grupos',
  guardianId: 'encargado',
  guardianIdentifier: 'identificación del encargado',
  identifier: 'identificación',
  infractionTypeId: 'tipo de falta',
  isActive: 'activo',
  justificationReason: 'motivo de la justificación',
  kind: 'tipo',
  lastName: 'apellido',
  legalReference: 'referencia normativa',
  limit: 'límite',
  maxCapacity: 'cupo máximo',
  message: 'mensaje',
  name: 'nombre',
  nationalId: 'cédula',
  newGroupId: 'nuevo grupo',
  newPassword: 'nueva contraseña',
  note: 'nota',
  observations: 'observaciones',
  occurredAt: 'fecha del hecho',
  page: 'página',
  pageSize: 'tamaño de página',
  participants: 'participantes',
  password: 'contraseña',
  periodId: 'periodo',
  permissionIds: 'permisos',
  permitDate: 'fecha del permiso',
  phone: 'teléfono',
  place: 'lugar',
  priority: 'prioridad',
  publishDate: 'fecha de publicación',
  q: 'búsqueda',
  reason: 'motivo',
  reasoning: 'fundamento',
  receivedByName: 'nombre de quien recibe',
  recipientType: 'tipo de destinatario',
  recipients: 'destinatarios',
  relationship: 'parentesco',
  resolution: 'resolución',
  role: 'rol',
  roleId: 'rol',
  roleIds: 'roles',
  search: 'búsqueda',
  secondLastname: 'segundo apellido',
  section: 'sección',
  sectionId: 'sección',
  severity: 'gravedad',
  sortBy: 'orden',
  sortOrder: 'dirección del orden',
  specialtyId: 'especialidad',
  startDate: 'fecha de inicio',
  startTime: 'hora de inicio',
  startsOn: 'fecha de inicio',
  status: 'estado',
  studentId: 'estudiante',
  studentIdentifier: 'identificación del estudiante',
  studentUserId: 'estudiante',
  subject: 'asunto',
  subjectId: 'materia',
  summary: 'resumen',
  time: 'hora',
  timeSlotId: 'bloque horario',
  title: 'título',
  to: 'hasta',
  token: 'código',
  type: 'tipo',
  userId: 'usuario',
  witnesses: 'testigos',
};

export function fieldLabel(property: string): string {
  return FIELD_LABELS[property] ?? property;
}

const quote = (property: string) => `«${fieldLabel(property)}»`;

type Translator = (field: string, raw: string) => string;

const firstNumber = (raw: string): string => raw.match(/-?\d+(\.\d+)?/)?.[0] ?? '';
const plural = (n: string, one: string, many: string) => (n === '1' ? one : many);

/** Traductores por nombre de restricción de class-validator. */
const TRANSLATORS: Record<string, Translator> = {
  isNotEmpty: (f) => `El campo ${f} es obligatorio.`,
  isDefined: (f) => `El campo ${f} es obligatorio.`,
  isString: (f) => `El campo ${f} debe ser un texto.`,
  isInt: (f) => `El campo ${f} debe ser un número entero.`,
  isNumber: (f) => `El campo ${f} debe ser un número.`,
  isNumberString: (f) => `El campo ${f} debe ser un número.`,
  isPositive: (f) => `El campo ${f} debe ser mayor que cero.`,
  isBoolean: (f) => `El campo ${f} debe ser verdadero o falso.`,
  isEmail: (f) => `El campo ${f} debe ser un correo electrónico válido.`,
  isUuid: (f) => `El campo ${f} no tiene un identificador válido.`,
  isUUID: (f) => `El campo ${f} no tiene un identificador válido.`,
  isDateString: (f) => `El campo ${f} debe ser una fecha válida.`,
  isIso8601: (f) => `El campo ${f} debe ser una fecha válida.`,
  isISO8601: (f) => `El campo ${f} debe ser una fecha válida.`,
  isDate: (f) => `El campo ${f} debe ser una fecha válida.`,
  isArray: (f) => `El campo ${f} debe ser una lista.`,
  isObject: (f) => `El campo ${f} tiene un formato inválido.`,
  isEnum: (f, raw) => {
    const values = raw.split(':')[1]?.trim();
    return values
      ? `El campo ${f} debe ser uno de estos valores: ${values}.`
      : `El campo ${f} tiene un valor no permitido.`;
  },
  isIn: (f, raw) => TRANSLATORS.isEnum(f, raw),
  matches: (f) => `El campo ${f} no tiene el formato esperado.`,
  min: (f, raw) => `El campo ${f} no puede ser menor que ${firstNumber(raw)}.`,
  max: (f, raw) => `El campo ${f} no puede ser mayor que ${firstNumber(raw)}.`,
  minLength: (f, raw) => {
    const n = firstNumber(raw);
    return `El campo ${f} debe tener al menos ${n} ${plural(n, 'carácter', 'caracteres')}.`;
  },
  maxLength: (f, raw) => {
    const n = firstNumber(raw);
    return `El campo ${f} no puede superar ${n} ${plural(n, 'carácter', 'caracteres')}.`;
  },
  isLength: (f, raw) => {
    const n = firstNumber(raw);
    return /shorter/.test(raw)
      ? `El campo ${f} no puede superar ${n} ${plural(n, 'carácter', 'caracteres')}.`
      : `El campo ${f} debe tener al menos ${n} ${plural(n, 'carácter', 'caracteres')}.`;
  },
  arrayMinSize: (f, raw) => {
    const n = firstNumber(raw);
    return `El campo ${f} debe tener al menos ${n} ${plural(n, 'elemento', 'elementos')}.`;
  },
  arrayMaxSize: (f, raw) => {
    const n = firstNumber(raw);
    return `El campo ${f} no puede tener más de ${n} ${plural(n, 'elemento', 'elementos')}.`;
  },
  arrayNotEmpty: (f) => `El campo ${f} debe tener al menos un elemento.`,
  whitelistValidation: (f) => `El campo ${f} no está permitido en esta solicitud.`,
  nestedValidation: (f) => `El campo ${f} tiene un formato inválido.`,
};

/**
 * Los mensajes por defecto de class-validator empiezan con el nombre de la
 * propiedad ("firstName must be…", "property x should not exist",
 * "each value in x …"). Si no, el DTO trae un mensaje propio y se respeta.
 */
function isDefaultMessage(property: string, raw: string): boolean {
  return (
    raw.startsWith(`${property} `) ||
    raw.startsWith(`property ${property} `) ||
    raw.startsWith(`each value in ${property} `) ||
    raw.startsWith('nested property ')
  );
}

export function translateConstraint(property: string, constraint: string, raw: string): string {
  if (!isDefaultMessage(property, raw)) return raw;
  const translator = TRANSLATORS[constraint];
  const each = raw.startsWith(`each value in ${property} `);
  const field = each ? `${quote(property)} (cada valor)` : quote(property);
  if (translator) return translator(field, raw);
  return `El campo ${quote(property)} tiene un valor inválido.`;
}

/**
 * Orden en que se reporta la primera falla de un campo: primero que exista,
 * luego el tipo y al final los límites. Así el usuario ve un mensaje por campo.
 */
const PRIORITY = [
  'whitelistValidation',
  'isDefined',
  'isNotEmpty',
  'arrayNotEmpty',
  'isString',
  'isInt',
  'isNumber',
  'isNumberString',
  'isBoolean',
  'isArray',
  'isObject',
  'isEmail',
  'isDateString',
  'isIso8601',
  'isISO8601',
  'isDate',
  'isUuid',
  'isUUID',
  'isEnum',
  'isIn',
];

function primaryConstraint(constraints: Record<string, string>): [string, string] {
  const entries = Object.entries(constraints);
  const rank = (key: string) => {
    const i = PRIORITY.indexOf(key);
    return i === -1 ? PRIORITY.length : i;
  };
  return entries.sort(([a], [b]) => rank(a) - rank(b))[0];
}

/** Aplana errores anidados (listas y objetos): un mensaje en español por campo. */
export function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  const walk = (list: ValidationError[]) => {
    for (const error of list) {
      if (error.constraints && Object.keys(error.constraints).length) {
        const [constraint, raw] = primaryConstraint(error.constraints);
        messages.push(translateConstraint(error.property, constraint, raw));
      }
      if (error.children?.length) walk(error.children);
    }
  };
  walk(errors);
  return [...new Set(messages)];
}

/** `exceptionFactory` del ValidationPipe global. */
export function spanishValidationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const messages = flattenValidationErrors(errors);
  return new BadRequestException({
    message: messages.length ? messages : ['Los datos enviados no son válidos.'],
    error: 'Bad Request',
    code: 'VALIDATION_ERROR',
  });
}
