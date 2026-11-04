-- Drop obsolete first_name / last_name columns from users.
-- Keep institutional naming: name, first_lastname, second_lastname.

-- Backfill from legacy columns when institutional fields are empty
UPDATE `users`
SET `name` = COALESCE(NULLIF(TRIM(`name`), ''), `first_name`)
WHERE (`name` IS NULL OR TRIM(`name`) = '')
  AND `first_name` IS NOT NULL
  AND TRIM(`first_name`) <> '';

UPDATE `users`
SET `first_lastname` = COALESCE(NULLIF(TRIM(`first_lastname`), ''), `last_name`)
WHERE (`first_lastname` IS NULL OR TRIM(`first_lastname`) = '')
  AND `last_name` IS NOT NULL
  AND TRIM(`last_name`) <> '';

-- Ensure non-null before enforcing NOT NULL
UPDATE `users` SET `name` = 'Sin nombre' WHERE `name` IS NULL OR TRIM(`name`) = '';
UPDATE `users` SET `first_lastname` = 'Sin apellido' WHERE `first_lastname` IS NULL OR TRIM(`first_lastname`) = '';

ALTER TABLE `users`
  MODIFY COLUMN `name` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `first_lastname` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `second_lastname` VARCHAR(100) NULL,
  DROP COLUMN `first_name`,
  DROP COLUMN `last_name`;
