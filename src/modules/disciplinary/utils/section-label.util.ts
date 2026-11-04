/** Avoid `10-10-1` when the group code already includes the grade level. */
export function composeSectionLabel(
  gradeLevel: number | null | undefined,
  groupName: string | null | undefined,
): string | null {
  const name = groupName?.trim() ?? '';
  if (!name) return null;
  if (gradeLevel == null) return name;
  if (name.includes('-')) return name;
  const prefix = `${gradeLevel}-`;
  if (name === String(gradeLevel) || name.startsWith(prefix)) return name;
  return `${prefix}${name}`;
}
