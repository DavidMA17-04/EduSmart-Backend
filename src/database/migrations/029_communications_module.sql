-- Sprint 5: Módulo oficial de Comunicados Institucionales (WF-65 al WF-76).
-- Tablas: communications, communication_recipients, communication_reads.
-- Permisos RBAC para Administrador, Director, Docente, Estudiante y Encargado.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Recrear tablas asegurando el esquema relacional con MySQL 8.0
DROP TABLE IF EXISTS `communication_reads`;
DROP TABLE IF EXISTS `communication_recipients`;
DROP TABLE IF EXISTS `communications`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `communications` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `priority` ENUM('URGENT', 'IMPORTANT', 'NORMAL') NOT NULL DEFAULT 'NORMAL',
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `requires_acknowledgment` TINYINT(1) NOT NULL DEFAULT 0,
  `publish_date` DATETIME NULL,
  `expiration_date` DATETIME NULL,
  `author_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_communications_status_dates` (`status`, `publish_date`, `expiration_date`),
  KEY `idx_communications_author` (`author_id`),
  CONSTRAINT `fk_communications_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `communication_recipients` (
  `id` CHAR(36) NOT NULL,
  `communication_id` CHAR(36) NOT NULL,
  `recipient_type` ENUM('ALL', 'ROLE', 'GROUP', 'USER') NOT NULL,
  `target_id` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comm_recipients_comm` (`communication_id`),
  KEY `idx_comm_recipients_target` (`recipient_type`, `target_id`),
  CONSTRAINT `fk_comm_recipients_comm` FOREIGN KEY (`communication_id`) REFERENCES `communications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `communication_reads` (
  `id` CHAR(36) NOT NULL,
  `communication_id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `read_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comm_user_read` (`communication_id`, `user_id`),
  KEY `idx_comm_reads_user` (`user_id`),
  CONSTRAINT `fk_comm_reads_comm` FOREIGN KEY (`communication_id`) REFERENCES `communications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comm_reads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Modificar ENUM de actions en permissions para soportar PUBLISH, MANAGE y STATS
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
    'RESPOND',
    'PUBLISH',
    'MANAGE',
    'STATS'
  ) NOT NULL;

-- 3. Catálogo de Permisos para COMMUNICATIONS
INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'communications.view', 'COMMUNICATIONS', 'VIEW', 'Ver comunicados institucionales asignados'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'communications.view');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'communications.create', 'COMMUNICATIONS', 'CREATE', 'Crear y editar borradores de comunicados'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'communications.create');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'communications.publish', 'COMMUNICATIONS', 'PUBLISH', 'Publicar comunicados para la comunidad'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'communications.publish');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'communications.manage', 'COMMUNICATIONS', 'MANAGE', 'Gestionar, archivar y eliminar cualquier comunicado'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'communications.manage');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`)
SELECT 'communications.stats', 'COMMUNICATIONS', 'STATS', 'Ver métricas y seguimiento de lecturas'
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `code` = 'communications.stats');

-- 4. Asignar Permisos a Roles por Defecto
-- Administrador y Director: Todos los permisos de COMMUNICATIONS
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Administrador', 'Director')
  AND p.`module` = 'COMMUNICATIONS'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

-- Docente: communications.view, communications.create, communications.publish
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Docente'
  AND p.`code` IN ('communications.view', 'communications.create', 'communications.publish')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

-- Estudiante: communications.view
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` = 'Estudiante'
  AND p.`code` = 'communications.view'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );

-- Encargado / Padre de familia: communications.view
INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT r.`id_roles`, p.`id_permissions`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`name` IN ('Encargado', 'Padre de familia')
  AND p.`code` = 'communications.view'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`id_roles` = r.`id_roles` AND rp.`id_permissions` = p.`id_permissions`
  );
