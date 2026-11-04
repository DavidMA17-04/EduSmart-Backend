-- Sprint 4 (PBI-33): catálogo de tipos de falta del módulo disciplinario (REAC 2026).
-- Rebajo y vía procesal se derivan de `severity` en el servidor (5/10/20/35/50).
-- Idempotente. No editar migraciones 001-024.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `disciplinary_infraction_types` (
  `id_disciplinary_infraction_types` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `severity` ENUM('VERY_MINOR', 'MINOR', 'SERIOUS', 'VERY_SERIOUS', 'EXTREMELY_SERIOUS') NOT NULL,
  `legal_reference` VARCHAR(100) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_disciplinary_infraction_types`),
  KEY `IDX_disc_infraction_types_severity` (`severity`),
  KEY `IDX_disc_infraction_types_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
