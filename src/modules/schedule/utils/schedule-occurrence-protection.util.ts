import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import {
  groupScheduleOccurrences,
  resolveOccurrenceForEntry,
  type ScheduleOccurrenceEntryInput,
  type ScheduleOccurrenceRun,
} from './schedule-occurrence.util';

export function scheduleEntryToOccurrenceInput(
  entry: ScheduleEntry,
): ScheduleOccurrenceEntryInput {
  if (!entry.timeSlot) {
    throw new Error(`ScheduleEntry ${entry.id} missing timeSlot relation`);
  }
  return {
    id: entry.id,
    teachingAssignmentId: entry.teachingAssignmentId,
    dayOfWeek: entry.dayOfWeek,
    slotType: entry.timeSlot.slotType ?? ScheduleSlotType.CLASS,
    startTime: String(entry.timeSlot.startTime),
    endTime: String(entry.timeSlot.endTime),
    displayOrder: entry.timeSlot.displayOrder,
  };
}

export function usedEntryIdsFromRuns(
  runs: ScheduleOccurrenceRun[],
  usedAnchors: ReadonlySet<number>,
): Set<number> {
  const used = new Set<number>();
  for (const run of runs) {
    if (usedAnchors.has(run.anchorEntryId)) {
      for (const id of run.entryIds) used.add(id);
    }
  }
  return used;
}

export { groupScheduleOccurrences, resolveOccurrenceForEntry };
