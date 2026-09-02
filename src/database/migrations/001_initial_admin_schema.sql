-- Sprint 1 administrative schema (Lucidchart / ERD)
-- MariaDB/MySQL. Apply on a clean database or after backing up existing data.
-- PKs are INT AUTO_INCREMENT. sections.id_specialties is nullable (ON DELETE SET NULL).

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `import_records`;
DROP TABLE IF EXISTS `import_batches`;
DROP TABLE IF EXISTS `import_jobs`;
DROP TABLE IF EXISTS `teaching_assignments`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `sections`;
DROP TABLE IF EXISTS `specialties`;
DROP TABLE IF EXISTS `academic_periods`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `auth_users`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `users` (
  `id_users` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `national_id` VARCHAR(30) NOT NULL,
  `first_lastname` VARCHAR(100) NOT NULL,
  `second_lastname` VARCHAR(100) NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_users`),
  UNIQUE KEY `UQ_users_national_id` (`national_id`),
  UNIQUE KEY `UQ_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `roles` (
  `id_roles` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_system_role` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_roles`),
  UNIQUE KEY `UQ_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `permissions` (
  `id_permissions` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(120) NOT NULL,
  `module` ENUM(
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
    'SECTIONS'
  ) NOT NULL,
  `action` ENUM('VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'CONFIGURE') NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_permissions`),
  UNIQUE KEY `UQ_permissions_code` (`code`),
  UNIQUE KEY `UQ_permissions_module_action` (`module`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_roles` (
  `id_users` INT NOT NULL,
  `id_roles` INT NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_users`, `id_roles`),
  CONSTRAINT `FK_user_roles_users` FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `FK_user_roles_roles` FOREIGN KEY (`id_roles`) REFERENCES `roles` (`id_roles`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `role_permissions` (
  `id_roles` INT NOT NULL,
  `id_permissions` INT NOT NULL,
  PRIMARY KEY (`id_roles`, `id_permissions`),
  CONSTRAINT `FK_role_permissions_roles` FOREIGN KEY (`id_roles`) REFERENCES `roles` (`id_roles`) ON DELETE CASCADE,
  CONSTRAINT `FK_role_permissions_permissions` FOREIGN KEY (`id_permissions`) REFERENCES `permissions` (`id_permissions`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `academic_periods` (
  `id_academic_periods` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('PLANNED', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'PLANNED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_academic_periods`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `specialties` (
  `id_specialties` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'UNDER_REVIEW') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_specialties`),
  UNIQUE KEY `UQ_specialties_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `sections` (
  `id_sections` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `grade_level` INT NOT NULL,
  `description` TEXT NULL,
  `id_academic_periods` INT NOT NULL,
  `id_specialties` INT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_sections`),
  CONSTRAINT `FK_sections_academic_periods` FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`) ON DELETE RESTRICT,
  CONSTRAINT `FK_sections_specialties` FOREIGN KEY (`id_specialties`) REFERENCES `specialties` (`id_specialties`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `groups` (
  `id_groups` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `student_count` INT NOT NULL DEFAULT 0,
  `id_sections` INT NOT NULL,
  `id_academic_periods` INT NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_groups`),
  UNIQUE KEY `UQ_groups_section_name` (`id_sections`, `name`),
  CONSTRAINT `FK_groups_sections` FOREIGN KEY (`id_sections`) REFERENCES `sections` (`id_sections`) ON DELETE RESTRICT,
  CONSTRAINT `FK_groups_academic_periods` FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `teaching_assignments` (
  `id_teaching_assignments` INT NOT NULL AUTO_INCREMENT,
  `id_users` INT NOT NULL,
  `id_groups` INT NOT NULL,
  `id_academic_periods` INT NULL,
  `is_guide_teacher` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_teaching_assignments`),
  UNIQUE KEY `UQ_teaching_assignments_user_group` (`id_users`, `id_groups`),
  CONSTRAINT `FK_teaching_assignments_users` FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `FK_teaching_assignments_groups` FOREIGN KEY (`id_groups`) REFERENCES `groups` (`id_groups`) ON DELETE CASCADE,
  CONSTRAINT `FK_teaching_assignments_periods` FOREIGN KEY (`id_academic_periods`) REFERENCES `academic_periods` (`id_academic_periods`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `import_batches` (
  `id_import_batches` INT NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(80) NOT NULL DEFAULT 'users',
  `summary` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_import_batches`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `import_records` (
  `id_import_records` INT NOT NULL AUTO_INCREMENT,
  `id_import_batches` INT NOT NULL,
  `row_number` INT NOT NULL,
  `status` ENUM('SUCCESS', 'ERROR') NOT NULL DEFAULT 'SUCCESS',
  `payload` JSON NULL,
  `error_message` TEXT NULL,
  PRIMARY KEY (`id_import_records`),
  CONSTRAINT `FK_import_records_batches` FOREIGN KEY (`id_import_batches`) REFERENCES `import_batches` (`id_import_batches`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `audit_logs` (
  `id_audit_logs` INT NOT NULL AUTO_INCREMENT,
  `actor_id` INT NULL,
  `action` VARCHAR(40) NOT NULL,
  `entity` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(36) NOT NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_audit_logs`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `roles` (`name`, `description`, `is_system_role`, `status`)
VALUES
  ('Administrador', 'Acceso completo al módulo administrativo', 1, 'ACTIVE'),
  ('Docente', 'Personal docente. Puede asignarse como docente guía de una sección.', 1, 'ACTIVE');

INSERT INTO `permissions` (`code`, `module`, `action`, `description`) VALUES
('administrator.view', 'ADMINISTRATOR', 'VIEW', 'Ver módulo administrativo'),
('administrator.create', 'ADMINISTRATOR', 'CREATE', 'Crear en módulo administrativo'),
('administrator.edit', 'ADMINISTRATOR', 'EDIT', 'Editar módulo administrativo'),
('administrator.delete', 'ADMINISTRATOR', 'DELETE', 'Eliminar en módulo administrativo'),
('administrator.export', 'ADMINISTRATOR', 'EXPORT', 'Exportar módulo administrativo'),
('administrator.configure', 'ADMINISTRATOR', 'CONFIGURE', 'Configurar módulo administrativo'),
('academic_structure.view', 'ACADEMIC_STRUCTURE', 'VIEW', 'Ver estructura académica'),
('academic_structure.create', 'ACADEMIC_STRUCTURE', 'CREATE', 'Crear estructura académica'),
('academic_structure.edit', 'ACADEMIC_STRUCTURE', 'EDIT', 'Editar estructura académica'),
('academic_structure.delete', 'ACADEMIC_STRUCTURE', 'DELETE', 'Eliminar estructura académica'),
('academic_structure.export', 'ACADEMIC_STRUCTURE', 'EXPORT', 'Exportar estructura académica'),
('academic_structure.configure', 'ACADEMIC_STRUCTURE', 'CONFIGURE', 'Configurar estructura académica'),
('periods.view', 'PERIODS', 'VIEW', 'Ver períodos'),
('periods.create', 'PERIODS', 'CREATE', 'Crear períodos'),
('periods.edit', 'PERIODS', 'EDIT', 'Editar períodos'),
('periods.delete', 'PERIODS', 'DELETE', 'Eliminar períodos'),
('periods.export', 'PERIODS', 'EXPORT', 'Exportar períodos'),
('periods.configure', 'PERIODS', 'CONFIGURE', 'Configurar períodos'),
('attendance.view', 'ATTENDANCE', 'VIEW', 'Ver asistencias'),
('attendance.create', 'ATTENDANCE', 'CREATE', 'Crear asistencias'),
('attendance.edit', 'ATTENDANCE', 'EDIT', 'Editar asistencias'),
('attendance.delete', 'ATTENDANCE', 'DELETE', 'Eliminar asistencias'),
('attendance.export', 'ATTENDANCE', 'EXPORT', 'Exportar asistencias'),
('attendance.configure', 'ATTENDANCE', 'CONFIGURE', 'Configurar asistencias'),
('students.view', 'STUDENTS', 'VIEW', 'Ver estudiantes'),
('students.create', 'STUDENTS', 'CREATE', 'Crear estudiantes'),
('students.edit', 'STUDENTS', 'EDIT', 'Editar estudiantes'),
('students.delete', 'STUDENTS', 'DELETE', 'Eliminar estudiantes'),
('students.export', 'STUDENTS', 'EXPORT', 'Exportar estudiantes'),
('students.configure', 'STUDENTS', 'CONFIGURE', 'Configurar estudiantes'),
('disciplinary.view', 'DISCIPLINARY', 'VIEW', 'Ver amonestaciones'),
('disciplinary.create', 'DISCIPLINARY', 'CREATE', 'Crear amonestaciones'),
('disciplinary.edit', 'DISCIPLINARY', 'EDIT', 'Editar amonestaciones'),
('disciplinary.delete', 'DISCIPLINARY', 'DELETE', 'Eliminar amonestaciones'),
('disciplinary.export', 'DISCIPLINARY', 'EXPORT', 'Exportar amonestaciones'),
('disciplinary.configure', 'DISCIPLINARY', 'CONFIGURE', 'Configurar amonestaciones'),
('communications.view', 'COMMUNICATIONS', 'VIEW', 'Ver avisos'),
('communications.create', 'COMMUNICATIONS', 'CREATE', 'Crear avisos'),
('communications.edit', 'COMMUNICATIONS', 'EDIT', 'Editar avisos'),
('communications.delete', 'COMMUNICATIONS', 'DELETE', 'Eliminar avisos'),
('communications.export', 'COMMUNICATIONS', 'EXPORT', 'Exportar avisos'),
('communications.configure', 'COMMUNICATIONS', 'CONFIGURE', 'Configurar avisos'),
('appeals.view', 'APPEALS', 'VIEW', 'Ver apelaciones'),
('appeals.create', 'APPEALS', 'CREATE', 'Crear apelaciones'),
('appeals.edit', 'APPEALS', 'EDIT', 'Editar apelaciones'),
('appeals.delete', 'APPEALS', 'DELETE', 'Eliminar apelaciones'),
('appeals.export', 'APPEALS', 'EXPORT', 'Exportar apelaciones'),
('appeals.configure', 'APPEALS', 'CONFIGURE', 'Configurar apelaciones'),
('roles_permissions.view', 'ROLES_PERMISSIONS', 'VIEW', 'Ver roles y permisos'),
('roles_permissions.create', 'ROLES_PERMISSIONS', 'CREATE', 'Crear roles y permisos'),
('roles_permissions.edit', 'ROLES_PERMISSIONS', 'EDIT', 'Editar roles y permisos'),
('roles_permissions.delete', 'ROLES_PERMISSIONS', 'DELETE', 'Eliminar roles y permisos'),
('roles_permissions.export', 'ROLES_PERMISSIONS', 'EXPORT', 'Exportar roles y permisos'),
('roles_permissions.configure', 'ROLES_PERMISSIONS', 'CONFIGURE', 'Configurar roles y permisos'),
('specialties.view', 'SPECIALTIES', 'VIEW', 'Ver especialidades'),
('specialties.create', 'SPECIALTIES', 'CREATE', 'Crear especialidades'),
('specialties.edit', 'SPECIALTIES', 'EDIT', 'Editar especialidades'),
('specialties.delete', 'SPECIALTIES', 'DELETE', 'Eliminar especialidades'),
('specialties.export', 'SPECIALTIES', 'EXPORT', 'Exportar especialidades'),
('specialties.configure', 'SPECIALTIES', 'CONFIGURE', 'Configurar especialidades'),
('sections.view', 'SECTIONS', 'VIEW', 'Ver secciones'),
('sections.create', 'SECTIONS', 'CREATE', 'Crear secciones'),
('sections.edit', 'SECTIONS', 'EDIT', 'Editar secciones'),
('sections.delete', 'SECTIONS', 'DELETE', 'Eliminar secciones'),
('sections.export', 'SECTIONS', 'EXPORT', 'Exportar secciones'),
('sections.configure', 'SECTIONS', 'CONFIGURE', 'Configurar secciones');

INSERT INTO `role_permissions` (`id_roles`, `id_permissions`)
SELECT 1, `id_permissions` FROM `permissions`;

INSERT INTO `users` (
  `name`, `national_id`, `first_lastname`, `second_lastname`, `email`, `password_hash`,
  `status`, `must_change_password`
) VALUES (
  'Administrador',
  '100000000',
  'CTP Hojancha',
  NULL,
  'admin@ctphojancha.ed.cr',
  '$2b$10$eiurVOYefhwrR0S10QHYC.vqhaKn0vPl2puY98C/s/R2BRIMpaWda',
  'ACTIVE',
  0
);

INSERT INTO `user_roles` (`id_users`, `id_roles`) VALUES (1, 1);

INSERT INTO `academic_periods` (`name`, `start_date`, `end_date`, `status`)
VALUES ('2026', '2026-01-01', '2026-12-31', 'ACTIVE');

INSERT INTO `specialties` (`name`, `description`, `status`)
VALUES ('Informática', 'Especialidad técnica de ejemplo para últimos años', 'ACTIVE');
