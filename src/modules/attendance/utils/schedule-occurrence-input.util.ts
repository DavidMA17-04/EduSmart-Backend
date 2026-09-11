import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import {
  ScheduleOccurrenceEntryInput,
} from '../../schedule/utils/schedule-occurrence.util';

export function toScheduleOccurrenceInput(
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
