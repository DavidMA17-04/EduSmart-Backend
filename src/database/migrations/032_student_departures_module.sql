-- Sprint 6: Control de salidas de estudiantes y seguridad institucional.
-- Rol "Guarda de Seguridad", permisos departures.*, tablas student_departures y
-- scheduled_departure_permits.
--
-- IDEMPOTENTE Y NO DESTRUCTIVA: no usa DROP ni TRUNCATE. Puede ejecutarse varias
-- veces sin perder registros (CREATE TABLE IF NOT EXISTS + INSERT ... WHERE NOT EXISTS).
--
-- Nota de esquema: `users` usa PK INT (`id_users`) y los vínculos de encargados
-- viven en `guardian_student_links`; las llaves foráneas siguen ese modelo real.

SET NAMES utf8mb4;

-- 1. Catálogo RBAC: nuevo módulo DEPARTURES y acción VALIDATE.
--    UQ_permissions_module_action exige un par (módulo, acción) único.
ALTER TABLE `permissions`
  MODIFY COLUMN `module` ENUM(
    'ADMINISTRATOR',
    'ACADEMIC_STRUCTURE',
    'PERIODS',
    'ATTENDANCE',
    'STUDENTS',
    'DISCIPLINARY',
    'COMMUNICATIONS',
    'APPEALS',
    'ROLES_PERMISSIONS',
    'SPECIALTIES',
    'SECTIONS',
    'SCHEDULES',
    'DEPARTURES'
  ) NOT NULL,
  MODIFY COLUMN `action` ENUM(
    'VIEW',
    'CREATE',
    'EDIT',
    'DELETE',
    'EXPORT',
    'CONFIGURE',
    'VIEW_OWN',
    'JUSTIFY',
    'REVIEW',
    'RESOLVE',
    'APPEAL',
    'PRECAUTIONARY',
    'RESPOND',
    'PUBLISH',
    'MANAGE',
    'STATS',
    'VALIDATE'
  ) NOT NULL;

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT seed.`code`, seed.`module`, seed.`action`, seed.`description`
FROM (
  SELECT 'departures.validate' AS `code`, 'DEPARTURES' AS `module`, 'VALIDATE' AS `action`,
         'Validar al encargado que retira a un estudiante' AS `description`
  UNION ALL SELECT 'departures.create', 'DEPARTURES', 'CREATE', 'Registrar salidas de estudiantes'
  UNION ALL SELECT 'departures.view_history', 'DEPARTURES', 'VIEW', 'Ver la bitácora de salidas'
  UNION ALL SELECT 'departures.export', 'DEPARTURES', 'EXPORT', 'Exportar la bitácora de salidas'
  UNION ALL SELECT 'departures.manage_permits', 'DEPARTURES', 'MANAGE', 'Gestionar permisos de salida programados'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = seed.`code`);

-- 2. Rol institucional del guarda.
INSERT INTO `roles` (`name`, `description`, `is_system_role`, `status`)
SELECT 'Guarda de Seguridad',
       'Personal de caseta. Valida encargados y registra salidas de estudiantes.',
       1,
       'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'Guarda de Seguridad');

-- 3. Asignaciones: Guarda (operación) y Administrador / Director (todo).
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE (
    (r.`name` = 'Guarda de Seguridad' AND p.`code` IN (
      'departures.validate',
      'departures.create',
      'departures.view_history',
      'departures.export'
    ))
    OR (r.`name` IN ('Administrador', 'Director') AND p.`code` IN (
      'departures.validate',
      'departures.create',
      'departures.view_history',
      'departures.export',
      'departures.manage_permits'
    ))
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

-- 4. Permisos de salida programados por Dirección / Coordinación.
CREATE TABLE IF NOT EXISTS `scheduled_departure_permits` (
  `id` CHAR(36) NOT NULL,
  `student_id` INT NOT NULL,
  `authorized_by_id` INT NOT NULL,
  `permit_date` DATE NOT NULL,
  `departure_time` TIME NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `completed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sdp_date_status` (`permit_date`, `status`),
  KEY `idx_sdp_student_date` (`student_id`, `permit_date`),
  CONSTRAINT `fk_sdp_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `fk_sdp_authorized_by` FOREIGN KEY (`authorized_by_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bitácora de salidas (autorizadas y denegadas).
CREATE TABLE IF NOT EXISTS `student_departures` (
  `id` CHAR(36) NOT NULL,
  `student_id` INT NOT NULL,
  `guardian_id` INT NULL COMMENT 'Encargado vinculado que retira (NULL si no coincide con un usuario)',
  `guardian_identifier` VARCHAR(30) NULL COMMENT 'Cédula presentada en caseta',
  `relationship` VARCHAR(50) NULL COMMENT 'Parentesco registrado al momento de la salida',
  `security_guard_id` INT NOT NULL,
  `scheduled_permit_id` CHAR(36) NULL,
  `departure_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('AUTHORIZED', 'REJECTED') NOT NULL,
  `departure_type` ENUM('REGULAR', 'EARLY', 'EMERGENCY') NOT NULL DEFAULT 'REGULAR',
  `justification_reason` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sd_student_time` (`student_id`, `departure_time`),
  KEY `idx_sd_time` (`departure_time`),
  KEY `idx_sd_status_time` (`status`, `departure_time`),
  CONSTRAINT `fk_sd_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `fk_sd_guardian` FOREIGN KEY (`guardian_id`) REFERENCES `users` (`id_users`) ON DELETE SET NULL,
  CONSTRAINT `fk_sd_guard` FOREIGN KEY (`security_guard_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `fk_sd_permit` FOREIGN KEY (`scheduled_permit_id`) REFERENCES `scheduled_departure_permits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
