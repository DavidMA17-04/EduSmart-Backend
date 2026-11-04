-- Sprint 4: tablas del módulo disciplinario (diseño D2).
-- El catálogo ya está en 025_disciplinary_infraction_types.sql.
-- Idempotente. No editar migraciones 001-025.
-- Los estados se guardan en inglés y se muestran en español en la aplicación:
--   REPORTED Reportada, INVESTIGATING En investigación, COMMUNICATED Comunicada,
--   PENDING_RESOLUTION Pendiente de resolución, RESOLVED Resuelta, IN_APPEAL En recurso,
--   FIRM Firme, DISMISSED Desestimada, ANNULLED Anulada, NOTIFIED Notificada.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `disciplinary_case_sequences` (
  `year` SMALLINT NOT NULL,
  `last_value` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_cases` (
  `id_disciplinary_cases` INT NOT NULL AUTO_INCREMENT,
  `case_number` VARCHAR(16) NOT NULL,
  `id_users_student` INT NOT NULL,
  `id_groups` INT NOT NULL,
  `id_academic_periods` INT NOT NULL,
  `id_disciplinary_infraction_types` INT NOT NULL,
  `id_subjects` INT NULL,
  `original_severity` ENUM('VERY_MINOR', 'MINOR', 'SERIOUS', 'VERY_SERIOUS', 'EXTREMELY_SERIOUS') NOT NULL,
  `severity` ENUM('VERY_MINOR', 'MINOR', 'SERIOUS', 'VERY_SERIOUS', 'EXTREMELY_SERIOUS') NOT NULL,
  `track` ENUM('DIRECT', 'DUE_PROCESS') NOT NULL,
  `status` ENUM(
    'REPORTED',
    'INVESTIGATING',
    'COMMUNICATED',
    'PENDING_RESOLUTION',
    'RESOLVED',
    'IN_APPEAL',
    'FIRM',
    'DISMISSED',
    'ANNULLED',
    'NOTIFIED'
  ) NOT NULL,
  `occurred_at` DATETIME NOT NULL,
  `place` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `witnesses` TEXT NULL,
  `is_late_report` TINYINT(1) NOT NULL DEFAULT 0,
  `late_report_reason` VARCHAR(500) NULL,
  `missing_guide_teacher` TINYINT(1) NOT NULL DEFAULT 0,
  `id_users_reporter` INT NOT NULL,
  `id_users_responsible` INT NULL,
  `step_started_on` DATE NOT NULL,
  `step_business_days` INT NOT NULL DEFAULT 0,
  `resolution_outcome` ENUM('DISMISS', 'MODIFY', 'UPHOLD') NULL,
  `resolution_reasoning` TEXT NULL,
  `notified_at` DATETIME NULL,
  `firm_at` DATETIME NULL,
  `annulled_at` DATETIME NULL,
  `annul_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_cases`),
  UNIQUE KEY `UQ_disciplinary_cases_number` (`case_number`),
  KEY `IDX_disciplinary_cases_student` (`id_users_student`),
  KEY `IDX_disciplinary_cases_status` (`status`),
  KEY `IDX_disciplinary_cases_group_period` (`id_groups`, `id_academic_periods`),
  CONSTRAINT `FK_disciplinary_cases_student` FOREIGN KEY (`id_users_student`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_cases_group` FOREIGN KEY (`id_groups`) REFERENCES `groups` (`id_groups`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_cases_period` FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_cases_type` FOREIGN KEY (`id_disciplinary_infraction_types`) REFERENCES `disciplinary_infraction_types` (`id_disciplinary_infraction_types`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_cases_subject` FOREIGN KEY (`id_subjects`) REFERENCES `subjects` (`id_subjects`) ON DELETE SET NULL,
  CONSTRAINT `FK_disciplinary_cases_reporter` FOREIGN KEY (`id_users_reporter`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_cases_responsible` FOREIGN KEY (`id_users_responsible`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_evidences` (
  `id_disciplinary_evidences` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `context` ENUM('REPORT', 'INVESTIGATION', 'DEFENSE', 'APPEAL', 'DELIVERY', 'FOLLOW_UP') NOT NULL,
  `id_users_author` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_evidences`),
  KEY `IDX_disciplinary_evidences_case` (`id_disciplinary_cases`),
  CONSTRAINT `FK_disciplinary_evidences_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_evidences_author` FOREIGN KEY (`id_users_author`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_case_events` (
  `id_disciplinary_case_events` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `type` VARCHAR(40) NOT NULL,
  `id_users_actor` INT NULL,
  `from_status` VARCHAR(32) NULL,
  `to_status` VARCHAR(32) NULL,
  `payload` JSON NULL,
  `visibility` ENUM('PUBLIC', 'RESERVED') NOT NULL DEFAULT 'PUBLIC',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_case_events`),
  KEY `IDX_disciplinary_case_events_case` (`id_disciplinary_cases`, `created_at`),
  CONSTRAINT `FK_disciplinary_case_events_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_case_events_actor` FOREIGN KEY (`id_users_actor`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_communications` (
  `id_disciplinary_communications` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `kind` ENUM('DIRECT_REPRIMAND', 'FORMAL_CHARGE', 'RESOLUTION', 'APPEAL_RESOLUTION', 'PRECAUTIONARY') NOT NULL,
  `body` MEDIUMTEXT NOT NULL,
  `id_users_issuer` INT NOT NULL,
  `issued_at` DATETIME NOT NULL,
  `delivery_medium` ENUM('NOTEBOOK', 'IN_PERSON') NULL,
  `delivered_at` DATETIME NULL,
  `id_users_delivered_by` INT NULL,
  `received_by_name` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_communications`),
  KEY `IDX_disciplinary_communications_case` (`id_disciplinary_cases`),
  CONSTRAINT `FK_disciplinary_communications_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_communications_issuer` FOREIGN KEY (`id_users_issuer`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_communications_delivered_by` FOREIGN KEY (`id_users_delivered_by`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_notifications` (
  `id_disciplinary_notifications` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_communications` INT NOT NULL,
  `id_users_guardian` INT NOT NULL,
  `email_status` ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SKIPPED',
  `read_at` DATETIME NULL,
  `read_ip` VARCHAR(45) NULL,
  `read_user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_notifications`),
  UNIQUE KEY `UQ_disciplinary_notifications_comm_guardian` (`id_disciplinary_communications`, `id_users_guardian`),
  CONSTRAINT `FK_disciplinary_notifications_communication` FOREIGN KEY (`id_disciplinary_communications`) REFERENCES `disciplinary_communications` (`id_disciplinary_communications`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_notifications_guardian` FOREIGN KEY (`id_users_guardian`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_defenses` (
  `id_disciplinary_defenses` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `body` TEXT NOT NULL,
  `channel` ENUM('PORTAL', 'WRITTEN') NOT NULL,
  `id_users_presented_by` INT NOT NULL,
  `presented_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_defenses`),
  KEY `IDX_disciplinary_defenses_case` (`id_disciplinary_cases`),
  CONSTRAINT `FK_disciplinary_defenses_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_defenses_presenter` FOREIGN KEY (`id_users_presented_by`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_appeals` (
  `id_disciplinary_appeals` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `kind` ENUM('REVOCATION', 'APPEAL') NOT NULL,
  `is_subsidiary` TINYINT(1) NOT NULL DEFAULT 0,
  `body` TEXT NOT NULL,
  `filed_at` DATETIME NOT NULL,
  `id_users_filed_by` INT NOT NULL,
  `outcome` ENUM('UPHOLD', 'REVOKE', 'MODIFY') NULL,
  `new_severity` ENUM('VERY_MINOR', 'MINOR', 'SERIOUS', 'VERY_SERIOUS', 'EXTREMELY_SERIOUS') NULL,
  `reasoning` TEXT NULL,
  `id_users_resolver` INT NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_appeals`),
  KEY `IDX_disciplinary_appeals_case` (`id_disciplinary_cases`),
  CONSTRAINT `FK_disciplinary_appeals_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_appeals_filer` FOREIGN KEY (`id_users_filed_by`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_appeals_resolver` FOREIGN KEY (`id_users_resolver`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_precautionary_measures` (
  `id_disciplinary_precautionary_measures` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `starts_on` DATE NOT NULL,
  `ends_on` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `pani_coordination` TINYINT(1) NOT NULL DEFAULT 0,
  `id_users_ordered_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_precautionary_measures`),
  KEY `IDX_disciplinary_precautionary_case` (`id_disciplinary_cases`),
  CONSTRAINT `FK_disciplinary_precautionary_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_precautionary_orderer` FOREIGN KEY (`id_users_ordered_by`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_follow_ups` (
  `id_disciplinary_follow_ups` INT NOT NULL AUTO_INCREMENT,
  `id_disciplinary_cases` INT NOT NULL,
  `kind` VARCHAR(80) NOT NULL,
  `followed_on` DATE NOT NULL,
  `description` TEXT NOT NULL,
  `participants` VARCHAR(255) NULL,
  `review_on` DATE NULL,
  `outcome` ENUM('PENDING', 'MET', 'UNMET') NOT NULL DEFAULT 'PENDING',
  `outcome_note` TEXT NULL,
  `id_users_author` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_follow_ups`),
  KEY `IDX_disciplinary_follow_ups_case` (`id_disciplinary_cases`),
  KEY `IDX_disciplinary_follow_ups_review` (`review_on`),
  CONSTRAINT `FK_disciplinary_follow_ups_case` FOREIGN KEY (`id_disciplinary_cases`) REFERENCES `disciplinary_cases` (`id_disciplinary_cases`) ON DELETE RESTRICT,
  CONSTRAINT `FK_disciplinary_follow_ups_author` FOREIGN KEY (`id_users_author`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `non_working_days` (
  `id_non_working_days` INT NOT NULL AUTO_INCREMENT,
  `day` DATE NOT NULL,
  `reason` VARCHAR(200) NOT NULL,
  `id_users_author` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_non_working_days`),
  UNIQUE KEY `UQ_non_working_days_day` (`day`),
  CONSTRAINT `FK_non_working_days_author` FOREIGN KEY (`id_users_author`) REFERENCES `users` (`id_users`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `disciplinary_settings` (
  `id_disciplinary_settings` INT NOT NULL,
  `recidivism_threshold` INT NOT NULL DEFAULT 3,
  `conduct_alert_threshold` INT NOT NULL DEFAULT 80,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_settings`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `disciplinary_settings` (`id_disciplinary_settings`, `recidivism_threshold`, `conduct_alert_threshold`)
SELECT 1, 3, 80
WHERE NOT EXISTS (
  SELECT 1 FROM `disciplinary_settings` s WHERE s.`id_disciplinary_settings` = 1
);
