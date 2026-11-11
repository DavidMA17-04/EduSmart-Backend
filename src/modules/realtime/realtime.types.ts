export type RealtimeEventType =
  | 'inbox.changed'
  | 'inbox.item'
  | 'alert.absenteeism'
  | 'alert.justification_pending'
  | 'alert.disciplinary'
  | 'session.revoked';

export type RealtimeEvent = {
  type: RealtimeEventType;
  at: string;
  unreadCount?: number;
  itemId?: number;
  sessionId?: number;
  message?: string;
};

export const REALTIME_USER_ROOM = (userId: number) => `user:${userId}`;
export const REALTIME_ROOM = {
  STAFF_ATTENDANCE: 'staff:attendance',
  STAFF_ATTENDANCE_REVIEW: 'staff:attendance_review',
} as const;
