-- Restaura baselines operativos de role_permissions (plantillas de fábrica).
-- Cubre deriva local: Docente sin attendance.*, Estudiante sin justify,
-- Encargado/Padre sin view_own/justify. Idempotente. Resuelve por nombre/código.

SET NAMES utf8mb4;

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Docente'
  AND p.`code` IN (
    'attendance.view',
    'attendance.create',
    'attendance.edit',
    'attendance.justify',
    'students.view',
    'schedules.view_own',
    'communications.view',
    'disciplinary.create',
    'disciplinary.view_own',
    'disciplinary.resolve',
    'academic_structure.view',
    'periods.view',
    'sections.view',
    'specialties.view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Estudiante'
  AND p.`code` IN (
    'attendance.view_own',
    'attendance.justify',
    'schedules.view_own',
    'communications.view',
    'appeals.create',
    'disciplinary.view_own'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );

DELETE rp
FROM `role_permissions` rp
INNER JOIN `roles` r ON r.`id_roles` = rp.`id_roles`
INNER JOIN `permissions` p ON p.`id_permissions` = rp.`id_permissions`
WHERE r.`name` = 'Estudiante'
  AND p.`code` IN ('attendance.view', 'students.view');

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Encargado', 'Padre de familia')
  AND p.`code` IN (
    'attendance.view_own',
    'attendance.justify',
    'disciplinary.view_own',
    'disciplinary.respond'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles`
      AND rp.`id_permissions` = p.`id_permissions`
  );
