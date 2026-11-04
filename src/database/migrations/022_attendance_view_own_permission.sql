-- PBI-28: attendance.view_own for Estudiante (own attendance history).
-- Idempotent. Does NOT grant attendance.view / create / edit.
-- Resolves role/permission IDs by name/code (no hardcoded IDs).

SET NAMES utf8mb4;

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'attendance.view_own', 'ATTENDANCE', 'VIEW_OWN', 'Ver el propio historial de asistencia'
WHERE NOT EXISTS (
  SELECT 1 FROM `permissions` p WHERE p.`code` = 'attendance.view_own'
);

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Estudiante'
  AND p.`code` = 'attendance.view_own'
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
