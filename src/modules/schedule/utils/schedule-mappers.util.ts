import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import {
  formatUserFullName,
  offeringKindLabel,
} from '../../attendance/utils/attendance-labels.util';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import { ScheduleTimeSlot } from '../entities/schedule-time-slot.entity';

export type ScheduleTimeSlotView = {
  id: number;
  lessonNumber: number | null;
  name: string;
  startTime: string;
  endTime: string;
  displayOrder: number;
  slotType: ScheduleSlotType;
  isActive: boolean;
};

export type ScheduleEntryView = {
  entryId: number;
  dayOfWeek: number;
  timeSlot: {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    displayOrder: number;
    slotType: ScheduleSlotType;
  };
  teachingAssignment: {
    id: number;
    teacher: { id: number; name: string };
    group: { id: number; name: string; gradeLevel: number | null };
    offering: {
      kind: AcademicOfferingKind;
      id: number;
      name: string;
      labelKind: string;
    };
    academicPeriod: { id: number; name: string } | null;
  };
};

function normalizeTime(value: string): string {
  const raw = String(value ?? '');
  // MySQL TIME may come as HH:mm:ss or Date-like string
  const match = raw.match(/(\d{2}:\d{2}:\d{2})/);
  if (match) return match[1];
  const short = raw.match(/(\d{2}:\d{2})/);
  if (short) return `${short[1]}:00`;
  return raw;
}

export function toTimeSlotView(slot: ScheduleTimeSlot): ScheduleTimeSlotView {
  return {
    id: slot.id,
    lessonNumber: slot.lessonNumber,
    name: slot.name,
    startTime: normalizeTime(slot.startTime),
    endTime: normalizeTime(slot.endTime),
    displayOrder: slot.displayOrder,
    slotType: slot.slotType,
    isActive: slot.isActive,
  };
}

export function toScheduleEntryView(entry: ScheduleEntry): ScheduleEntryView {
  const ta = entry.teachingAssignment;
  const slot = entry.timeSlot;
  if (!ta || !slot) {
    throw new Error('ScheduleEntry relations teachingAssignment and timeSlot required');
  }
  if (!ta.offeringKind) {
    throw new Error('ScheduleEntry TA must be impartable');
  }

  const offeringId =
    ta.offeringKind === AcademicOfferingKind.SUBJECT
      ? ta.subjectId
      : ta.specialtyId;
  const offeringName =
    ta.offeringKind === AcademicOfferingKind.SUBJECT
      ? ta.subject?.name
      : ta.specialty?.name;

  if (offeringId == null || !offeringName) {
    throw new Error('ScheduleEntry TA offering unresolved');
  }

  const teacherName = ta.user
    ? formatUserFullName(ta.user)
    : `Docente #${ta.userId}`;

  return {
    entryId: entry.id,
    dayOfWeek: entry.dayOfWeek,
    timeSlot: {
      id: slot.id,
      name: slot.name,
      startTime: normalizeTime(slot.startTime),
      endTime: normalizeTime(slot.endTime),
      displayOrder: slot.displayOrder,
      slotType: slot.slotType,
      },
    teachingAssignment: {
      id: ta.id,
      teacher: { id: ta.userId, name: teacherName },
      group: {
        id: ta.groupId,
        name: ta.group?.name ?? `Grupo #${ta.groupId}`,
        gradeLevel: ta.group?.section?.gradeLevel ?? null,
      },
      offering: {
        kind: ta.offeringKind,
        id: offeringId,
        name: offeringName,
        labelKind: offeringKindLabel(ta.offeringKind),
      },
      academicPeriod: ta.academicPeriod
        ? { id: ta.academicPeriod.id, name: ta.academicPeriod.name }
        : ta.academicPeriodId != null
          ? { id: ta.academicPeriodId, name: `Período #${ta.academicPeriodId}` }
          : null,
    },
  };
}

/** Relations needed to build ScheduleEntryView */
export const SCHEDULE_ENTRY_RELATIONS = {
  timeSlot: true,
  teachingAssignment: {
    user: true,
    group: { section: true },
    subject: true,
    specialty: true,
    academicPeriod: true,
  },
} as const;
