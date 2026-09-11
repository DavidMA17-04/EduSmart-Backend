-- Phase B1: schedules.view / schedules.edit for Administrador.
-- Extends permissions.module ENUM with SCHEDULES. Resolves IDs by code/name (idempotent).

SET NAMES utf8mb4;

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
    'SCHEDULES'
  ) NOT NULL;

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'schedules.view', 'SCHEDULES', 'VIEW', 'Ver horarios'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'schedules.view'
);

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'schedules.edit', 'SCHEDULES', 'EDIT', 'Editar horarios'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'schedules.edit'
);

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Administrador'
  AND p.`code` IN ('schedules.view', 'schedules.edit')
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
