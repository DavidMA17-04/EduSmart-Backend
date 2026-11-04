/** Normaliza una cédula: solo dígitos (acepta "1-0234-0567", "102340567"). */
export function normalizeNationalId(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Muestra solo los últimos 4 dígitos: "•••••0567". */
export function maskNationalId(value: string | null | undefined): string {
  const digits = normalizeNationalId(value ?? '');
  if (digits.length <= 4) return digits;
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function fullName(
  name: string | null | undefined,
  firstLastname?: string | null,
  secondLastname?: string | null,
): string {
  return [name, firstLastname, secondLastname]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  FATHER: 'Padre',
  MOTHER: 'Madre',
  GUARDIAN: 'Encargado legal',
  LEGAL_GUARDIAN: 'Encargado legal',
  GRANDFATHER: 'Abuelo',
  GRANDMOTHER: 'Abuela',
  GRANDPARENT: 'Abuelo(a)',
  SIBLING: 'Hermano(a)',
  BROTHER: 'Hermano',
  SISTER: 'Hermana',
  UNCLE: 'Tío',
  AUNT: 'Tía',
  STEPFATHER: 'Padrastro',
  STEPMOTHER: 'Madrastra',
  OTHER: 'Otro',
};

/** Parentesco legible: traduce códigos (FATHER) y respeta el texto libre ("Madre"). */
export function relationshipLabel(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  return RELATIONSHIP_LABELS[text.toUpperCase()] ?? text;
}
