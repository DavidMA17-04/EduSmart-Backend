-- Phase 0 / Attendance foundations: subjects catalog, teaching assignment offerings, group enrollments.
-- Do not edit migrations 001-007.
-- MySQL 8. Duplicate teaching assignments: assignment_fingerprint GENERATED VIRTUAL + UNIQUE.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `subjects` (
  `id_subjects` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(30) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_subjects`),
  UNIQUE KEY `UQ_subjects_name` (`name`),
  UNIQUE KEY `UQ_subjects_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing rows (guide teachers) keep NULL offering columns.
ALTER TABLE `teaching_assignments`
  ADD COLUMN `offering_kind` ENUM(
    'SUBJECT',
    'EXPLORATORY_WORKSHOP',
    'TECHNICAL_SPECIALTY'
  ) NULL AFTER `is_guide_teacher`,
  ADD COLUMN `id_subjects` INT NULL AFTER `offering_kind`,
  ADD COLUMN `id_specialties` INT NULL AFTER `id_subjects`;

-- InnoDB uses UQ (id_users, id_groups) as supporting index for FK on id_users.
-- Add a dedicated users index before dropping the old unique.
ALTER TABLE `teaching_assignments`
  ADD KEY `IDX_teaching_assignments_users` (`id_users`);

-- Drop old unique: one teacher may hold several offerings on the same group.
ALTER TABLE `teaching_assignments`
  DROP INDEX `UQ_teaching_assignments_user_group`;

ALTER TABLE `teaching_assignments`
  ADD CONSTRAINT `FK_teaching_assignments_subjects`
    FOREIGN KEY (`id_subjects`) REFERENCES `subjects` (`id_subjects`) ON DELETE RESTRICT,
  ADD CONSTRAINT `FK_teaching_assignments_specialties`
    FOREIGN KEY (`id_specialties`) REFERENCES `specialties` (`id_specialties`) ON DELETE RESTRICT;

-- Fingerprint coalesces NULLs to 0 / '' so MySQL UNIQUE is reliable.
-- Guide-only rows (no offering): user:group:::0:0:period — at most one such slot per tuple.
ALTER TABLE `teaching_assignments`
  ADD COLUMN `assignment_fingerprint` VARCHAR(80)
    GENERATED ALWAYS AS (
      CONCAT(
        `id_users`, ':',
        `id_groups`, ':',
        IFNULL(`offering_kind`, ''), ':',
        IFNULL(`id_subjects`, 0), ':',
        IFNULL(`id_specialties`, 0), ':',
        IFNULL(`id_academic_periods`, 0)
      )
    ) VIRTUAL,
  ADD UNIQUE KEY `UQ_teaching_assignments_fingerprint` (`assignment_fingerprint`);

CREATE INDEX `IDX_teaching_assignments_group_offering`
  ON `teaching_assignments` (`id_groups`, `offering_kind`);

CREATE TABLE IF NOT EXISTS `group_enrollments` (
  `id_group_enrollments` INT NOT NULL AUTO_INCREMENT,
  `id_users` INT NOT NULL,
  `id_groups` INT NOT NULL,
  `id_academic_periods` INT NOT NULL,
  `starts_on` DATE NOT NULL,
  `ends_on` DATE NULL,
  `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_group_enrollments`),
  KEY `IDX_group_enrollments_user_dates` (`id_users`, `starts_on`, `ends_on`),
  KEY `IDX_group_enrollments_group_dates` (`id_groups`, `starts_on`, `ends_on`),
  KEY `IDX_group_enrollments_period` (`id_academic_periods`),
  CONSTRAINT `FK_group_enrollments_users`
    FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `FK_group_enrollments_groups`
    FOREIGN KEY (`id_groups`) REFERENCES `groups` (`id_groups`) ON DELETE RESTRICT,
  CONSTRAINT `FK_group_enrollments_periods`
    FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
