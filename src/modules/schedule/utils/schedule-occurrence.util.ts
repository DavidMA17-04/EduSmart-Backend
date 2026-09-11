import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';

/**
 * Lean entry shape for occurrence/run grouping (F1).
 * No DB access. slotType other than CLASS never joins a run.
 * isActive is intentionally absent — inactive CLASS slots still participate
 * when a ScheduleEntry references them.
 */
export type ScheduleOccurrenceEntryInput = {
  id: number;
  teachingAssignmentId: number;
  dayOfWeek: number;
  slotType: ScheduleSlotType | string;
  startTime: string;
  endTime: string;
  displayOrder: number;
};

/**
 * Programmed class occurrence = contiguous CLASS run for one TA + day.
 * anchorEntryId = chronological first entry of the run (F2 FK target).
 */
export type ScheduleOccurrenceRun = {
  anchorEntryId: number;
  entryIds: number[];
  teachingAssignmentId: number;
  dayOfWeek: number;
  /** First block start (HH:mm:ss). */
  startTime: string;
  /** Last block end (HH:mm:ss). */
  endTime: string;
};

function normalizeTime(value: string): string {
  const raw = String(value ?? '');
  const match = raw.match(/(\d{2}:\d{2}:\d{2})/);
  if (match) return match[1];
  const short = raw.match(/(\d{2}:\d{2})/);
  if (short) return `${short[1]}:00`;
  return raw;
}

function isClassSlot(slotType: ScheduleSlotType | string): boolean {
  return String(slotType) === ScheduleSlotType.CLASS;
}

function compareOccurrenceEntries(
  a: ScheduleOccurrenceEntryInput,
  b: ScheduleOccurrenceEntryInput,
): number {
  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
  const aStart = normalizeTime(a.startTime);
  const bStart = normalizeTime(b.startTime);
  if (aStart !== bStart) return aStart < bStart ? -1 : 1;
  const aEnd = normalizeTime(a.endTime);
  const bEnd = normalizeTime(b.endTime);
  if (aEnd !== bEnd) return aEnd < bEnd ? -1 : 1;
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }
  return a.id - b.id;
}

function toRun(
  teachingAssignmentId: number,
  dayOfWeek: number,
  members: ScheduleOccurrenceEntryInput[],
): ScheduleOccurrenceRun {
  const first = members[0];
  const last = members[members.length - 1];
  return {
    anchorEntryId: first.id,
    entryIds: members.map((m) => m.id),
    teachingAssignmentId,
    dayOfWeek,
    startTime: normalizeTime(first.startTime),
    endTime: normalizeTime(last.endTime),
  };
}

/**
 * Groups CLASS ScheduleEntries into contiguous occurrence runs.
 *
 * Continuity (exact):
 * same teachingAssignmentId + dayOfWeek + both CLASS
 * + previous.endTime === next.startTime
 *
 * BREAK / LUNCH / any time gap splits runs.
 * displayOrder is sort tie-break only — not continuity authority.
 */
export function groupScheduleOccurrences(
  entries: readonly ScheduleOccurrenceEntryInput[],
): ScheduleOccurrenceRun[] {
  const classEntries = entries.filter((e) => isClassSlot(e.slotType));
  if (classEntries.length === 0) return [];

  const byTaDay = new Map<string, ScheduleOccurrenceEntryInput[]>();
  for (const entry of classEntries) {
    const key = `${entry.teachingAssignmentId}:${entry.dayOfWeek}`;
    const bucket = byTaDay.get(key);
    if (bucket) bucket.push(entry);
    else byTaDay.set(key, [entry]);
  }

  const runs: ScheduleOccurrenceRun[] = [];

  for (const bucket of byTaDay.values()) {
    const sorted = [...bucket].sort(compareOccurrenceEntries);
    let current: ScheduleOccurrenceEntryInput[] = [];

    for (const entry of sorted) {
      if (current.length === 0) {
        current = [entry];
        continue;
      }
      const prev = current[current.length - 1];
      const contiguous =
        normalizeTime(prev.endTime) === normalizeTime(entry.startTime);
      if (contiguous) {
        current.push(entry);
      } else {
        runs.push(
          toRun(prev.teachingAssignmentId, prev.dayOfWeek, current),
        );
        current = [entry];
      }
    }

    if (current.length > 0) {
      const head = current[0];
      runs.push(toRun(head.teachingAssignmentId, head.dayOfWeek, current));
    }
  }

  return runs.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    if (a.startTime !== b.startTime) {
      return a.startTime < b.startTime ? -1 : 1;
    }
    if (a.teachingAssignmentId !== b.teachingAssignmentId) {
      return a.teachingAssignmentId - b.teachingAssignmentId;
    }
    return a.anchorEntryId - b.anchorEntryId;
  });
}

/**
 * Canonical run containing entryId (any member → same anchorEntryId).
 * Returns null if entry missing or not CLASS.
 */
export function resolveOccurrenceForEntry(
  entries: readonly ScheduleOccurrenceEntryInput[],
  entryId: number,
): ScheduleOccurrenceRun | null {
  const target = entries.find((e) => e.id === entryId);
  if (!target || !isClassSlot(target.slotType)) {
    return null;
  }
  const runs = groupScheduleOccurrences(entries);
  return runs.find((r) => r.entryIds.includes(entryId)) ?? null;
}
