export const PERMISSIONS = {
  STUDENTS_CREATE: 'students.create',
  STUDENTS_READ: 'students.read',
  STUDENTS_UPDATE: 'students.update',
  ATTENDANCE_REGISTER: 'attendance.register',
  ATTENDANCE_READ: 'attendance.read',
  DISCIPLINARY_CREATE: 'disciplinary.create',
  DISCIPLINARY_READ: 'disciplinary.read',
  COMMUNICATIONS_CREATE: 'communications.create',
  COMMUNICATIONS_READ: 'communications.read',
  APPEALS_CREATE: 'appeals.create',
  APPEALS_REVIEW: 'appeals.review',
  APPEALS_RESOLVE: 'appeals.resolve',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
