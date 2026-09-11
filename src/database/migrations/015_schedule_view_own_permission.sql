-- Phase D1.1: schedules.view_own for Docente (own weekly schedule).
-- Extends permissions.action ENUM with VIEW_OWN (preserves prior values).
-- Idempotent. DO NOT grant schedules.view or schedules.edit to Docente.
-- Resolves role/permission IDs by name/code (no hardcoded IDs).
-- Does NOT alter permissions.module or UNIQUE constraints.

SET NAMES utf8mb4;

ALTER TABLE `permissions`
  MODIFY COLUMN `action` ENUM(
    'VIEW',
    'CREATE',
    'EDIT',
    'DELETE',
    'EXPORT',
    'CONFIGURE',
    'VIEW_OWN'
  ) NOT NULL;

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'schedules.view_own', 'SCHEDULES', 'VIEW_OWN', 'Ver el propio horario'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'schedules.view_own'
);

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Docente'
  AND p.`code` = 'schedules.view_own'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
