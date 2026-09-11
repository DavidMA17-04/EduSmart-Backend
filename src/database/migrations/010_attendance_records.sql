-- Phase 1A / PBI-24: attendance records (one row per student per session).
-- Table name `attendance` follows MER + existing stub; PK id_attendance (INT, not UUID).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance` (
  `id_attendance` INT NOT NULL AUTO_INCREMENT,
  `id_attendance_sessions` INT NOT NULL,
  `id_users_student` INT NOT NULL,
  `status` ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL,
  `registration_method` ENUM('MANUAL', 'TOKEN') NOT NULL DEFAULT 'MANUAL',
  `registered_at` DATETIME NOT NULL,
  `id_users_registered_by` INT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `id_users_updated_by` INT NULL,
  PRIMARY KEY (`id_attendance`),
  UNIQUE KEY `UQ_attendance_session_student` (`id_attendance_sessions`, `id_users_student`),
  KEY `IDX_attendance_student` (`id_users_student`),
  KEY `IDX_attendance_registered_by` (`id_users_registered_by`),
  KEY `IDX_attendance_updated_by` (`id_users_updated_by`),
  CONSTRAINT `FK_attendance_sessions`
    FOREIGN KEY (`id_attendance_sessions`) REFERENCES `attendance_sessions` (`id_attendance_sessions`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_attendance_student`
    FOREIGN KEY (`id_users_student`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_attendance_registered_by`
    FOREIGN KEY (`id_users_registered_by`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_attendance_updated_by`
    FOREIGN KEY (`id_users_updated_by`) REFERENCES `users` (`id_users`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
