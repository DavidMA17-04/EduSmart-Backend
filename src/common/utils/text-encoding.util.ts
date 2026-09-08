const MOJIBAKE_PATTERN = /[\u0080-\u009f\u2500-\u257f]|Ã.|�/;

export function hasMojibake(value: string | null | undefined): boolean {
  if (!value) return false;
  return MOJIBAKE_PATTERN.test(value);
}
