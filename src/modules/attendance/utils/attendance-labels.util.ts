import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';

export function offeringKindLabel(kind: AcademicOfferingKind): string {
  switch (kind) {
    case AcademicOfferingKind.SUBJECT:
      return 'Asignatura';
    case AcademicOfferingKind.EXPLORATORY_WORKSHOP:
      return 'Taller exploratorio';
    case AcademicOfferingKind.TECHNICAL_SPECIALTY:
      return 'Especialidad técnica';
    default:
      return String(kind);
  }
}

export function formatUserFullName(user: {
  name: string;
  first_lastname: string;
  second_lastname?: string | null;
}): string {
  const parts = [user.name, user.first_lastname, user.second_lastname ?? '']
    .map((p) => String(p).trim())
    .filter(Boolean);
  return parts.join(' ');
}
