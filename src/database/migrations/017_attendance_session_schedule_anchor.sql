-- Phase F1: optional schedule occurrence anchor on attendance_sessions.
-- id_schedule_entries = chronological first ScheduleEntry of a CLASS run (same TA + day + exact time adjacency).
-- Manual sessions keep NULL. No backfill. Schedule/Attendance records untouched.
-- MySQL UNIQUE allows multiple NULLs → manual sessions remain unrestricted.
-- Do NOT apply until authorized (entity update follows apply).

SET NAMES utf8mb4;

ALTER TABLE `attendance_sessions`
  ADD COLUMN `id_schedule_entries` INT NULL
    COMMENT 'Anchor ScheduleEntry of programmed occurrence run'
    AFTER `id_teaching_assignments`,
  ADD UNIQUE KEY `UQ_attendance_sessions_schedule_anchor_date` (
    `id_schedule_entries`,
    `session_date`
  ),
  ADD CONSTRAINT `FK_attendance_sessions_schedule_entries`
    FOREIGN KEY (`id_schedule_entries`)
    REFERENCES `schedule_entries` (`id_schedule_entries`)
    ON DELETE RESTRICT;
