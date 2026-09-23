-- Fase 3 MEP: años lectivos, vínculo a cursos lectivos (academic_periods), cupo máximo en secciones (groups).
-- Alias API históricos (academic_periods / specialties) se conservan; terminología MEP en capa de presentación.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `academic_years` (
  `id_academic_years` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('PLANNED', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'PLANNED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_academic_years`),
  UNIQUE KEY `UQ_academic_years_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill años solo si la tabla está vacía y hay períodos.
INSERT INTO `academic_years` (`name`, `start_date`, `end_date`, `status`)
SELECT
  CONCAT('Año ', YEAR(`start_date`)),
  MIN(`start_date`),
  MAX(`end_date`),
  CASE
    WHEN SUM(CASE WHEN `status` = 'ACTIVE' THEN 1 ELSE 0 END) > 0 THEN 'ACTIVE'
    WHEN SUM(CASE WHEN `status` = 'PLANNED' THEN 1 ELSE 0 END) > 0 THEN 'PLANNED'
    ELSE 'CLOSED'
  END
FROM `academic_periods`
WHERE (SELECT COUNT(*) FROM `academic_years`) = 0
GROUP BY YEAR(`start_date`);

SET @col_year := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'academic_periods'
    AND COLUMN_NAME = 'id_academic_years'
);
SET @sql_year := IF(
  @col_year = 0,
  'ALTER TABLE `academic_periods` ADD COLUMN `id_academic_years` INT NULL AFTER `id_academic_periods`',
  'SELECT 1'
);
PREPARE stmt_year FROM @sql_year;
EXECUTE stmt_year;
DEALLOCATE PREPARE stmt_year;

UPDATE `academic_periods` ap
INNER JOIN `academic_years` ay ON ay.`name` = CONCAT('Año ', YEAR(ap.`start_date`))
SET ap.`id_academic_years` = ay.`id_academic_years`
WHERE ap.`id_academic_years` IS NULL;

UPDATE `academic_periods` ap
SET ap.`id_academic_years` = (
  SELECT ay.`id_academic_years` FROM `academic_years` ay ORDER BY ay.`id_academic_years` ASC LIMIT 1
)
WHERE ap.`id_academic_years` IS NULL
  AND EXISTS (SELECT 1 FROM `academic_years` ay2);

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'academic_periods'
    AND CONSTRAINT_NAME = 'FK_academic_periods_academic_years'
);
SET @sql_fk := IF(
  @fk_exists = 0,
  'ALTER TABLE `academic_periods` ADD CONSTRAINT `FK_academic_periods_academic_years` FOREIGN KEY (`id_academic_years`) REFERENCES `academic_years` (`id_academic_years`) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

SET @col_cap := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'groups'
    AND COLUMN_NAME = 'max_capacity'
);
SET @sql_cap := IF(
  @col_cap = 0,
  'ALTER TABLE `groups` ADD COLUMN `max_capacity` INT NOT NULL DEFAULT 30 AFTER `student_count`',
  'SELECT 1'
);
PREPARE stmt_cap FROM @sql_cap;
EXECUTE stmt_cap;
DEALLOCATE PREPARE stmt_cap;

UPDATE `groups`
SET `max_capacity` = GREATEST(`student_count`, 30)
WHERE `max_capacity` < `student_count`;
