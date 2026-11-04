-- History query indexes + PBI-25 session attendance tokens (MySQL).
-- Does not alter migrations 001-017 or their unique keys.

SET NAMES utf8mb4;

ALTER TABLE `attendance_sessions`
  ADD COLUMN `attendance_token` VARCHAR(32) NULL
    COMMENT 'Alphanumeric redeem code for open sessions (PBI-25)'
    AFTER `status`,
  ADD COLUMN `attendance_token_expires_at` DATETIME NULL
    COMMENT 'Token validity end (session window / end of CR day)'
    AFTER `attendance_token`,
  ADD UNIQUE KEY `UQ_attendance_sessions_token` (`attendance_token`);

-- History filters: status within a session; student timeline; date+TA list
ALTER TABLE `attendance`
  ADD KEY `IDX_attendance_session_status` (`id_attendance_sessions`, `status`),
  ADD KEY `IDX_attendance_student_registered` (`id_users_student`, `registered_at`);

ALTER TABLE `attendance_sessions`
  ADD KEY `IDX_attendance_sessions_date_ta` (`session_date`, `id_teaching_assignments`);
