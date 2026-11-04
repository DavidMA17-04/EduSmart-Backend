-- Phase B1: schedule entries linked to impartable TeachingAssignments.
-- Teacher/group/offering/period live on teaching_assignments (no denormalization).
-- ON DELETE RESTRICT on both FKs. Exact UNIQUE + app-level teacher/group conflict checks.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_entries` (
  `id_schedule_entries` INT NOT NULL AUTO_INCREMENT,
  `id_teaching_assignments` INT NOT NULL,
  `day_of_week` TINYINT NOT NULL,
  `id_schedule_time_slots` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_schedule_entries`),
  UNIQUE KEY `UQ_schedule_entries_ta_day_slot` (
    `id_teaching_assignments`,
    `day_of_week`,
    `id_schedule_time_slots`
  ),
  KEY `IDX_schedule_entries_day_slot` (`day_of_week`, `id_schedule_time_slots`),
  KEY `IDX_schedule_entries_ta` (`id_teaching_assignments`),
  KEY `IDX_schedule_entries_slot` (`id_schedule_time_slots`),
  CONSTRAINT `CHK_schedule_entries_day_of_week`
    CHECK (`day_of_week` BETWEEN 1 AND 5),
  CONSTRAINT `FK_schedule_entries_teaching_assignments`
    FOREIGN KEY (`id_teaching_assignments`)
    REFERENCES `teaching_assignments` (`id_teaching_assignments`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_schedule_entries_time_slots`
    FOREIGN KEY (`id_schedule_time_slots`)
    REFERENCES `schedule_time_slots` (`id_schedule_time_slots`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
