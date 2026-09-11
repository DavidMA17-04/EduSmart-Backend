import { describe, expect, it } from '@jest/globals';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import {
  groupScheduleOccurrences,
  resolveOccurrenceForEntry,
  type ScheduleOccurrenceEntryInput,
} from './schedule-occurrence.util';

function entry(
  partial: Partial<ScheduleOccurrenceEntryInput> &
    Pick<
      ScheduleOccurrenceEntryInput,
      'id' | 'teachingAssignmentId' | 'dayOfWeek' | 'startTime' | 'endTime'
    >,
): ScheduleOccurrenceEntryInput {
  return {
    slotType: ScheduleSlotType.CLASS,
    displayOrder: partial.displayOrder ?? partial.id,
    ...partial,
  };
}

describe('groupScheduleOccurrences / resolveOccurrenceForEntry (F1)', () => {
  it('1. single entry → run of 1', () => {
    const rows = [
      entry({
        id: 10,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
    ];
    const runs = groupScheduleOccurrences(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({
      anchorEntryId: 10,
      entryIds: [10],
      teachingAssignmentId: 5,
      dayOfWeek: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
    });
  });

  it('2. two exact adjacent same TA → 1 run', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 1,
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
        displayOrder: 2,
      }),
    ];
    const runs = groupScheduleOccurrences(rows);
    expect(runs).toHaveLength(1);
    expect(runs[0].entryIds).toEqual([1, 2]);
    expect(runs[0].anchorEntryId).toBe(1);
    expect(runs[0].startTime).toBe('07:00:00');
    expect(runs[0].endTime).toBe('08:20:00');
  });

  it('3. three exact adjacent same TA → 1 run', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 2,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 2,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
      entry({
        id: 3,
        teachingAssignmentId: 5,
        dayOfWeek: 2,
        startTime: '08:20:00',
        endTime: '09:00:00',
      }),
    ];
    const run = groupScheduleOccurrences(rows)[0];
    expect(run.entryIds).toEqual([1, 2, 3]);
    expect(run.anchorEntryId).toBe(1);
    expect(run.endTime).toBe('09:00:00');
  });

  it('4. temporal gap splits', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:45:00',
        endTime: '08:25:00',
      }),
    ];
    const runs = groupScheduleOccurrences(rows);
    expect(runs).toHaveLength(2);
    expect(runs[0].entryIds).toEqual([1]);
    expect(runs[1].entryIds).toEqual([2]);
  });

  it('5. BREAK splits (even if CLASS times would otherwise chain)', () => {
    // CLASS — BREAK — CLASS: only CLASS rows are inputs here; gap 07:40→08:00 splits
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      {
        id: 99,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ScheduleSlotType.BREAK,
        startTime: '07:40:00',
        endTime: '08:00:00',
        displayOrder: 2,
      },
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '08:40:00',
        displayOrder: 3,
      }),
    ];
    const runs = groupScheduleOccurrences(rows);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.entryIds)).toEqual([[1], [2]]);
  });

  it('6. LUNCH splits', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '10:00:00',
        endTime: '10:40:00',
      }),
      {
        id: 50,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ScheduleSlotType.LUNCH,
        startTime: '10:40:00',
        endTime: '11:20:00',
        displayOrder: 5,
      },
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '11:20:00',
        endTime: '12:00:00',
        displayOrder: 6,
      }),
    ];
    expect(groupScheduleOccurrences(rows)).toHaveLength(2);
  });

  it('7. different TA splits even if times touch', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 8,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
    ];
    const runs = groupScheduleOccurrences(rows);
    expect(runs).toHaveLength(2);
    expect(runs.find((r) => r.teachingAssignmentId === 5)?.entryIds).toEqual([
      1,
    ]);
    expect(runs.find((r) => r.teachingAssignmentId === 8)?.entryIds).toEqual([
      2,
    ]);
  });

  it('8. different day splits', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 2,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
    ];
    expect(groupScheduleOccurrences(rows)).toHaveLength(2);
  });

  it('9. unordered input still groups', () => {
    const rows = [
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
        displayOrder: 2,
      }),
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 1,
      }),
    ];
    const run = groupScheduleOccurrences(rows)[0];
    expect(run.entryIds).toEqual([1, 2]);
    expect(run.anchorEntryId).toBe(1);
  });

  it('10. anchor = first chronological', () => {
    const rows = [
      entry({
        id: 30,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '08:20:00',
        endTime: '09:00:00',
        displayOrder: 1,
      }),
      entry({
        id: 10,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 99,
      }),
      entry({
        id: 20,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
        displayOrder: 50,
      }),
    ];
    const run = groupScheduleOccurrences(rows)[0];
    expect(run.anchorEntryId).toBe(10);
    expect(run.entryIds).toEqual([10, 20, 30]);
  });

  it('11. any member resolves same anchor', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
      entry({
        id: 3,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '08:20:00',
        endTime: '09:00:00',
      }),
    ];
    const a = resolveOccurrenceForEntry(rows, 1);
    const b = resolveOccurrenceForEntry(rows, 2);
    const c = resolveOccurrenceForEntry(rows, 3);
    expect(a?.anchorEntryId).toBe(1);
    expect(b?.anchorEntryId).toBe(1);
    expect(c?.anchorEntryId).toBe(1);
    expect(a?.entryIds).toEqual([1, 2, 3]);
    expect(b?.entryIds).toEqual(a?.entryIds);
  });

  it('12. displayOrder adjacent but time gap → split', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 1,
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '08:40:00',
        displayOrder: 2,
      }),
    ];
    expect(groupScheduleOccurrences(rows)).toHaveLength(2);
  });

  it('13. time adjacent but different TA → split', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 3,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 9,
        dayOfWeek: 3,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
    ];
    expect(groupScheduleOccurrences(rows)).toHaveLength(2);
  });

  it('14. inactive CLASS referenced still participates (no isActive filter)', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
    ];
    // Helper has no isActive field — inactive slots still form runs when entries exist
    const run = groupScheduleOccurrences(rows)[0];
    expect(run.entryIds).toEqual([1, 2]);
    expect(resolveOccurrenceForEntry(rows, 2)?.anchorEntryId).toBe(1);
  });

  it('resolveOccurrenceForEntry: missing / BREAK → null', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00:00',
        endTime: '07:40:00',
      }),
      {
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ScheduleSlotType.BREAK,
        startTime: '07:40:00',
        endTime: '08:00:00',
        displayOrder: 2,
      },
    ];
    expect(resolveOccurrenceForEntry(rows, 999)).toBeNull();
    expect(resolveOccurrenceForEntry(rows, 2)).toBeNull();
  });

  it('normalizes HH:mm times for adjacency', () => {
    const rows = [
      entry({
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '07:40',
      }),
      entry({
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        startTime: '07:40:00',
        endTime: '08:20:00',
      }),
    ];
    expect(groupScheduleOccurrences(rows)).toHaveLength(1);
  });
});
