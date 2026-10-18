-- Departamentos académicos del colegio y perfil docente.
-- Los docentes son usuarios con rol Docente; el departamento vive en teacher_profiles.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `departments` (
  `id_departments` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_departments`),
  UNIQUE KEY `UQ_departments_code` (`code`),
  UNIQUE KEY `UQ_departments_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `teacher_profiles` (
  `id_users` INT NOT NULL,
  `id_departments` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_users`),
  KEY `IDX_teacher_profiles_department` (`id_departments`),
  CONSTRAINT `FK_teacher_profiles_users`
    FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE,
  CONSTRAINT `FK_teacher_profiles_departments`
    FOREIGN KEY (`id_departments`) REFERENCES `departments` (`id_departments`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `departments` (`code`, `name`, `description`, `status`, `sort_order`)
SELECT v.`code`, v.`name`, v.`description`, 'ACTIVE', v.`sort_order`
FROM (
  SELECT 'CIENCIAS' AS `code`, 'Ciencias' AS `name`, 'Biología, química y física' AS `description`, 10 AS `sort_order`
  UNION ALL SELECT 'MATEMATICAS', 'Matemáticas', 'Matemáticas y estadísticas', 20
  UNION ALL SELECT 'ESTUDIOS_SOCIALES', 'Estudios sociales', 'Historia, geografía y cívica', 30
  UNION ALL SELECT 'ESPANOL', 'Español', 'Lengua y literatura', 40
  UNION ALL SELECT 'INGLES', 'Inglés', 'Idioma inglés', 50
  UNION ALL SELECT 'INFORMATICA', 'Informática', 'Tecnologías de la información', 60
  UNION ALL SELECT 'COCINA', 'Cocina', 'Gastronomía y cocina institucional', 70
  UNION ALL SELECT 'EDUCACION_FISICA', 'Educación física', 'Educación física y deporte', 80
  UNION ALL SELECT 'ORIENTACION', 'Orientación', 'Orientación educativa', 90
  UNION ALL SELECT 'ESPECIALIDADES', 'Especialidades técnicas', 'Carreras y talleres técnicos', 100
  UNION ALL SELECT 'OTROS', 'Otros', 'Otros departamentos académicos', 999
) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM `departments` d WHERE d.`code` = v.`code`
);
