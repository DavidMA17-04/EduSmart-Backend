-- Phase B1: weekly schedule time slots (configurable institutional blocks).
-- DO NOT assume these times are permanent; seed is an editable baseline.
-- MySQL 8 / InnoDB / utf8mb4.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `schedule_time_slots` (
  `id_schedule_time_slots` INT NOT NULL AUTO_INCREMENT,
  `lesson_number` INT NULL,
  `name` VARCHAR(80) NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `display_order` INT NOT NULL,
  `slot_type` ENUM('CLASS', 'BREAK', 'LUNCH') NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_schedule_time_slots`),
  KEY `IDX_schedule_time_slots_display_order` (`display_order`),
  KEY `IDX_schedule_time_slots_type_active` (`slot_type`, `is_active`),
  CONSTRAINT `CHK_schedule_time_slots_range`
    CHECK (`start_time` < `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotent seed by (display_order, slot_type, start_time, end_time).
INSERT INTO `schedule_time_slots`
  (`lesson_number`, `name`, `start_time`, `end_time`, `display_order`, `slot_type`, `is_active`)
SELECT v.`lesson_number`, v.`name`, v.`start_time`, v.`end_time`, v.`display_order`, v.`slot_type`, 1
FROM (
  SELECT 1 AS `lesson_number`, 'Lección 1' AS `name`, '07:00:00' AS `start_time`, '07:40:00' AS `end_time`, 1 AS `display_order`, 'CLASS' AS `slot_type`
  UNION ALL SELECT 2, 'Lección 2', '07:40:00', '08:20:00', 2, 'CLASS'
  UNION ALL SELECT NULL, 'Recreo', '08:20:00', '08:35:00', 3, 'BREAK'
  UNION ALL SELECT 3, 'Lección 3', '08:35:00', '09:15:00', 4, 'CLASS'
  UNION ALL SELECT 4, 'Lección 4', '09:15:00', '09:55:00', 5, 'CLASS'
  UNION ALL SELECT NULL, 'Recreo corto', '09:55:00', '10:00:00', 6, 'BREAK'
  UNION ALL SELECT 5, 'Lección 5', '10:00:00', '10:40:00', 7, 'CLASS'
  UNION ALL SELECT 6, 'Lección 6', '10:40:00', '11:20:00', 8, 'CLASS'
  UNION ALL SELECT NULL, 'Almuerzo', '11:20:00', '12:10:00', 9, 'LUNCH'
  UNION ALL SELECT 7, 'Lección 7', '12:10:00', '12:50:00', 10, 'CLASS'
  UNION ALL SELECT 8, 'Lección 8', '12:50:00', '13:30:00', 11, 'CLASS'
  UNION ALL SELECT NULL, 'Recreo', '13:30:00', '13:45:00', 12, 'BREAK'
  UNION ALL SELECT 9, 'Lección 9', '13:45:00', '14:25:00', 13, 'CLASS'
  UNION ALL SELECT 10, 'Lección 10', '14:25:00', '15:05:00', 14, 'CLASS'
  UNION ALL SELECT NULL, 'Recreo corto', '15:05:00', '15:10:00', 15, 'BREAK'
  UNION ALL SELECT 11, 'Lección 11', '15:10:00', '15:50:00', 16, 'CLASS'
  UNION ALL SELECT 12, 'Lección 12', '15:50:00', '16:20:00', 17, 'CLASS'
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM `schedule_time_slots` s
  WHERE s.`display_order` = v.`display_order`
    AND s.`slot_type` = v.`slot_type`
    AND s.`start_time` = v.`start_time`
    AND s.`end_time` = v.`end_time`
);
