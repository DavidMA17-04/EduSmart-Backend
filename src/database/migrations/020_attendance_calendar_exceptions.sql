-- Fase 4 (PO-02-15): calendar exceptions for exam weeks / institutional periods.
-- Idempotent where practical. Do not edit migrations 001-019.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance_calendar_exceptions` (
  `id_attendance_calendar_exceptions` INT NOT NULL AUTO_INCREMENT,
  `id_academic_periods` INT NOT NULL,
  `id_sections` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `exception_type` ENUM('SUSPENDED', 'AUTO_JUSTIFIED') NOT NULL,
  `id_users_created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_attendance_calendar_exceptions`),
  KEY `IDX_att_cal_exc_period` (`id_academic_periods`),
  KEY `IDX_att_cal_exc_section` (`id_sections`),
  KEY `IDX_att_cal_exc_dates` (`start_date`, `end_date`),
  KEY `IDX_att_cal_exc_type` (`exception_type`),
  KEY `IDX_att_cal_exc_created_by` (`id_users_created_by`),
  CONSTRAINT `FK_att_cal_exc_period`
    FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_att_cal_exc_section`
    FOREIGN KEY (`id_sections`) REFERENCES `sections` (`id_sections`)
    ON DELETE SET NULL,
  CONSTRAINT `FK_att_cal_exc_created_by`
    FOREIGN KEY (`id_users_created_by`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
