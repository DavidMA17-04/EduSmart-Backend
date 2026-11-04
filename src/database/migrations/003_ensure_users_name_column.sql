-- Ensure users.name (nombre de pila) exists and institutional naming is intact.
-- Idempotent for MariaDB/MySQL via information_schema checks.

SET @db := DATABASE();

-- Add `name` if missing
SET @has_name := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'name'
);

SET @sql_add_name := IF(
  @has_name = 0,
  'ALTER TABLE `users` ADD COLUMN `name` VARCHAR(100) NOT NULL DEFAULT ''Sin nombre'' AFTER `national_id`',
  'SELECT 1'
);
PREPARE stmt_add_name FROM @sql_add_name;
EXECUTE stmt_add_name;
DEALLOCATE PREPARE stmt_add_name;

-- Ensure `first_lastname` exists
SET @has_first_lastname := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'first_lastname'
);

SET @sql_add_fl := IF(
  @has_first_lastname = 0,
  'ALTER TABLE `users` ADD COLUMN `first_lastname` VARCHAR(100) NOT NULL DEFAULT ''Sin apellido'' AFTER `name`',
  'SELECT 1'
);
PREPARE stmt_add_fl FROM @sql_add_fl;
EXECUTE stmt_add_fl;
DEALLOCATE PREPARE stmt_add_fl;

-- Ensure `second_lastname` exists (nullable)
SET @has_second_lastname := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'second_lastname'
);

SET @sql_add_sl := IF(
  @has_second_lastname = 0,
  'ALTER TABLE `users` ADD COLUMN `second_lastname` VARCHAR(100) NULL AFTER `first_lastname`',
  'SELECT 1'
);
PREPARE stmt_add_sl FROM @sql_add_sl;
EXECUTE stmt_add_sl;
DEALLOCATE PREPARE stmt_add_sl;

-- Normalize empties before enforcing NOT NULL
UPDATE `users` SET `name` = 'Sin nombre' WHERE `name` IS NULL OR TRIM(`name`) = '';
UPDATE `users` SET `first_lastname` = 'Sin apellido' WHERE `first_lastname` IS NULL OR TRIM(`first_lastname`) = '';

-- Enforce column definitions
ALTER TABLE `users`
  MODIFY COLUMN `name` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `first_lastname` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `second_lastname` VARCHAR(100) NULL;

-- Drop temporary defaults only when present (from ADD COLUMN backfill)
SET @name_default := (
  SELECT COLUMN_DEFAULT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name'
);
SET @sql_drop_name_def := IF(
  @name_default IS NOT NULL,
  'ALTER TABLE `users` ALTER COLUMN `name` DROP DEFAULT',
  'SELECT 1'
);
PREPARE stmt_drop_name_def FROM @sql_drop_name_def;
EXECUTE stmt_drop_name_def;
DEALLOCATE PREPARE stmt_drop_name_def;

SET @fl_default := (
  SELECT COLUMN_DEFAULT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'first_lastname'
);
SET @sql_drop_fl_def := IF(
  @fl_default IS NOT NULL,
  'ALTER TABLE `users` ALTER COLUMN `first_lastname` DROP DEFAULT',
  'SELECT 1'
);
PREPARE stmt_drop_fl_def FROM @sql_drop_fl_def;
EXECUTE stmt_drop_fl_def;
DEALLOCATE PREPARE stmt_drop_fl_def;
