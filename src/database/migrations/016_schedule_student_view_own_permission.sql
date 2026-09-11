-- Phase E1: grant existing schedules.view_own to Estudiante (student weekly schedule).
-- Does NOT insert a new permission. Does NOT alter ENUMs or UNIQUE constraints.
-- Idempotent. Resolves role/permission IDs by name/code (no hardcoded IDs).
-- Does NOT grant schedules.view or schedules.edit. Does NOT touch Docente/Administrador.

SET NAMES utf8mb4;

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Estudiante'
  AND p.`code` = 'schedules.view_own'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
