-- PBI-27: absence justifications + evidence + attendance.justification_status + permissions.
-- Idempotent where practical. Do not edit migrations 001-017.

SET NAMES utf8mb4;

-- Side-state on attendance marks (ABSENT stays ABSENT; this tracks justification).
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'attendance'
    AND COLUMN_NAME = 'justification_status'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `attendance` ADD COLUMN `justification_status` ENUM(''NONE'',''PENDING'',''JUSTIFIED'',''REJECTED'') NOT NULL DEFAULT ''NONE'' AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `absence_justifications` (
  `id_absence_justifications` INT NOT NULL AUTO_INCREMENT,
  `id_attendance` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `id_users_reviewed_by` INT NULL,
  `reviewed_at` DATETIME NULL,
  `decision_notes` TEXT NULL,
  `id_users_created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_absence_justifications`),
  KEY `IDX_absence_justifications_attendance` (`id_attendance`),
  KEY `IDX_absence_justifications_status` (`status`),
  KEY `IDX_absence_justifications_reviewed_by` (`id_users_reviewed_by`),
  KEY `IDX_absence_justifications_created_by` (`id_users_created_by`),
  CONSTRAINT `FK_absence_justifications_attendance`
    FOREIGN KEY (`id_attendance`) REFERENCES `attendance` (`id_attendance`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_absence_justifications_reviewed_by`
    FOREIGN KEY (`id_users_reviewed_by`) REFERENCES `users` (`id_users`)
    ON DELETE SET NULL,
  CONSTRAINT `FK_absence_justifications_created_by`
    FOREIGN KEY (`id_users_created_by`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `justification_evidences` (
  `id_justification_evidences` INT NOT NULL AUTO_INCREMENT,
  `id_absence_justifications` INT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `storage_path` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size_bytes` INT NOT NULL,
  `id_users_uploaded_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_justification_evidences`),
  KEY `IDX_justification_evidences_justification` (`id_absence_justifications`),
  KEY `IDX_justification_evidences_uploaded_by` (`id_users_uploaded_by`),
  CONSTRAINT `FK_justification_evidences_justification`
    FOREIGN KEY (`id_absence_justifications`) REFERENCES `absence_justifications` (`id_absence_justifications`)
    ON DELETE CASCADE,
  CONSTRAINT `FK_justification_evidences_uploaded_by`
    FOREIGN KEY (`id_users_uploaded_by`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Distinct actions required by UQ_permissions_module_action (cannot reuse CREATE/EDIT).
ALTER TABLE `permissions`
  MODIFY COLUMN `action` ENUM(
    'VIEW',
    'CREATE',
    'EDIT',
    'DELETE',
    'EXPORT',
    'CONFIGURE',
    'VIEW_OWN',
    'JUSTIFY',
    'REVIEW'
  ) NOT NULL;

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'attendance.justify', 'ATTENDANCE', 'JUSTIFY', 'Solicitar justificación de ausencia'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'attendance.justify'
);

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'attendance.review', 'ATTENDANCE', 'REVIEW', 'Dictaminar justificación de ausencia'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'attendance.review'
);

-- Emit: Estudiante / Encargado (if role exists) / Administrador
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Estudiante', 'Encargado', 'Administrador')
  AND p.`code` = 'attendance.justify'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );

-- Review: Docente / Orientador (if role exists) / Administrador
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Docente', 'Orientador', 'Administrador')
  AND p.`code` = 'attendance.review'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );

-- Docente already has attendance.view; ensure Estudiante can view own list context if needed
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Estudiante', 'Encargado')
  AND p.`code` = 'attendance.view'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
