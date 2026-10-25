import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';

export function readReceiptLabel(guardianName: string, readAt: Date): string {
  const [year, month, day] = calendarDateInTimeZone(readAt).split('-');
  return `Leída por ${guardianName} el ${day}/${month}/${year}`;
}

export function personName(row: {
  name?: unknown;
  firstLastname?: unknown;
  secondLastname?: unknown;
}): string {
  return [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' ');
}
