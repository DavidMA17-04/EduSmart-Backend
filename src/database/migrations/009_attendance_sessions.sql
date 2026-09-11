-- Phase 1A / PBI-24: attendance sessions (one real class tied to a TeachingAssignment).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id_attendance_sessions` INT NOT NULL AUTO_INCREMENT,
  `id_teaching_assignments` INT NOT NULL,
  `session_date` DATE NOT NULL,
  `started_at` DATETIME NOT NULL,
  `closed_at` DATETIME NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `id_users_created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_attendance_sessions`),
  KEY `IDX_attendance_sessions_ta` (`id_teaching_assignments`),
  KEY `IDX_attendance_sessions_date` (`session_date`),
  KEY `IDX_attendance_sessions_created_by` (`id_users_created_by`),
  CONSTRAINT `FK_attendance_sessions_teaching_assignments`
    FOREIGN KEY (`id_teaching_assignments`) REFERENCES `teaching_assignments` (`id_teaching_assignments`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_attendance_sessions_created_by`
    FOREIGN KEY (`id_users_created_by`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
