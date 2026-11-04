-- Phase 1A.1: grant Docente the attendance permissions required for PBI-24.
-- Resolves role/permissions by name/code (no hardcoded ids). Idempotent.

SET NAMES utf8mb4;

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Docente'
  AND p.`code` IN (
    'attendance.view',
    'attendance.create',
    'attendance.edit'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
