-- Sprint 4: roles y permisos del módulo disciplinario (diseño D7).
-- Conserva los valores actuales de permissions.action y agrega
-- RESOLVE, APPEAL, PRECAUTIONARY y RESPOND.
-- Idempotente. Resuelve roles y permisos por nombre o código.

SET NAMES utf8mb4;

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
    'REVIEW',
    'RESOLVE',
    'APPEAL',
    'PRECAUTIONARY',
    'RESPOND'
  ) NOT NULL;

INSERT INTO `roles` (`name`, `description`, `is_system_role`, `status`)
SELECT 'Orientador', 'Personal de orientación. Emite criterio técnico no vinculante.', 1, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM `roles` r WHERE r.`name` = 'Orientador');

INSERT INTO `roles` (`name`, `description`, `is_system_role`, `status`)
SELECT 'Director', 'Dirección institucional. Resuelve apelaciones y ordena el retiro precautorio.', 1, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM `roles` r WHERE r.`name` = 'Director');

INSERT INTO `roles` (`name`, `description`, `is_system_role`, `status`)
SELECT 'Encargado', 'Encargado legal. Consulta los expedientes de sus representados y responde.', 1, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM `roles` r WHERE r.`name` = 'Encargado');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.view_own', 'DISCIPLINARY', 'VIEW_OWN', 'Ver los expedientes propios'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.view_own');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.review', 'DISCIPLINARY', 'REVIEW', 'Emitir criterio de Orientación'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.review');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.resolve', 'DISCIPLINARY', 'RESOLVE', 'Conducir y resolver expedientes'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.resolve');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.appeal', 'DISCIPLINARY', 'APPEAL', 'Resolver apelaciones'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.appeal');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.precautionary', 'DISCIPLINARY', 'PRECAUTIONARY', 'Ordenar retiro precautorio'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.precautionary');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'disciplinary.respond', 'DISCIPLINARY', 'RESPOND', 'Responder como encargado'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.`code` = 'disciplinary.respond');

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Docente'
  AND p.`code` IN ('disciplinary.create', 'disciplinary.view_own', 'disciplinary.resolve')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

DELETE rp
FROM `role_permissions` rp
INNER JOIN `roles` r ON r.`id_roles` = rp.`id_roles`
INNER JOIN `permissions` p ON p.`id_permissions` = rp.`id_permissions`
WHERE r.`name` = 'Docente'
  AND p.`code` = 'disciplinary.view';

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Orientador'
  AND p.`code` IN ('disciplinary.view', 'disciplinary.review', 'disciplinary.export')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Director'
  AND p.`code` IN (
    'disciplinary.view',
    'disciplinary.appeal',
    'disciplinary.precautionary',
    'disciplinary.export'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Encargado', 'Padre de familia')
  AND p.`code` IN ('disciplinary.view_own', 'disciplinary.respond')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Estudiante'
  AND p.`code` = 'disciplinary.view_own'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Administrador'
  AND p.`module` = 'DISCIPLINARY'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );
