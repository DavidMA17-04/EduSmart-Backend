-- PBI-29 / WF-43: absenteeism alerts persistence (rules + alerts + in-app notifications).
-- Idempotent. Resolves FKs by table/column names (no hardcoded IDs).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `absenteeism_alert_rules` (
  `id_absenteeism_alert_rules` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `threshold_value` INT NOT NULL,
  `risk_level` ENUM('HIGH', 'MEDIUM') NOT NULL DEFAULT 'HIGH',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_absenteeism_alert_rules`),
  UNIQUE KEY `UQ_absenteeism_alert_rules_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `absenteeism_alert_rules` (`code`, `label`, `threshold_value`, `risk_level`, `is_active`)
SELECT 'UNJUSTIFIED_ABSENCES_MONTH', '5+ ausencias injustificadas en el mes', 5, 'HIGH', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `absenteeism_alert_rules` r WHERE r.`code` = 'UNJUSTIFIED_ABSENCES_MONTH'
);

INSERT INTO `absenteeism_alert_rules` (`code`, `label`, `threshold_value`, `risk_level`, `is_active`)
SELECT 'ATTENDANCE_PERCENT_MIN', 'Porcentaje de asistencia menor a 75%', 75, 'HIGH', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `absenteeism_alert_rules` r WHERE r.`code` = 'ATTENDANCE_PERCENT_MIN'
);

INSERT INTO `absenteeism_alert_rules` (`code`, `label`, `threshold_value`, `risk_level`, `is_active`)
SELECT 'CONSECUTIVE_ABSENCES', '3 o más ausencias consecutivas', 3, 'HIGH', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `absenteeism_alert_rules` r WHERE r.`code` = 'CONSECUTIVE_ABSENCES'
);

INSERT INTO `absenteeism_alert_rules` (`code`, `label`, `threshold_value`, `risk_level`, `is_active`)
SELECT 'ABSENCES_IN_PERIOD', 'Acumulación de 10+ ausencias en el período', 10, 'HIGH', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `absenteeism_alert_rules` r WHERE r.`code` = 'ABSENCES_IN_PERIOD'
);

INSERT INTO `absenteeism_alert_rules` (`code`, `label`, `threshold_value`, `risk_level`, `is_active`)
SELECT 'MEDIUM_UNJUSTIFIED_ABSENCES_MONTH', '3–4 ausencias injustificadas en el mes (observación)', 3, 'MEDIUM', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `absenteeism_alert_rules` r WHERE r.`code` = 'MEDIUM_UNJUSTIFIED_ABSENCES_MONTH'
);

CREATE TABLE IF NOT EXISTS `absenteeism_alerts` (
  `id_absenteeism_alerts` INT NOT NULL AUTO_INCREMENT,
  `id_users_student` INT NOT NULL,
  `id_groups` INT NULL,
  `risk_level` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
  `status` ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'NEW',
  `rule_codes` JSON NOT NULL,
  `unjustified_absences_month` INT NOT NULL DEFAULT 0,
  `absences_period` INT NOT NULL DEFAULT 0,
  `consecutive_absences` INT NOT NULL DEFAULT 0,
  `attendance_percent` DECIMAL(5,1) NOT NULL DEFAULT 0.0,
  `last_absence_date` DATE NULL,
  `window_start` DATE NOT NULL,
  `window_end` DATE NOT NULL,
  `idempotency_key` VARCHAR(120) NOT NULL,
  `triggered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_at` DATETIME NULL,
  `resolved_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_absenteeism_alerts`),
  UNIQUE KEY `UQ_absenteeism_alerts_idempotency` (`idempotency_key`),
  KEY `IDX_absenteeism_alerts_student` (`id_users_student`),
  KEY `IDX_absenteeism_alerts_group` (`id_groups`),
  KEY `IDX_absenteeism_alerts_risk` (`risk_level`),
  KEY `IDX_absenteeism_alerts_status` (`status`),
  CONSTRAINT `FK_absenteeism_alerts_student`
    FOREIGN KEY (`id_users_student`) REFERENCES `users` (`id_users`)
    ON DELETE RESTRICT,
  CONSTRAINT `FK_absenteeism_alerts_group`
    FOREIGN KEY (`id_groups`) REFERENCES `groups` (`id_groups`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `absenteeism_alert_notifications` (
  `id_absenteeism_alert_notifications` INT NOT NULL AUTO_INCREMENT,
  `id_absenteeism_alerts` INT NOT NULL,
  `channel` ENUM('IN_APP', 'EMAIL') NOT NULL DEFAULT 'IN_APP',
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL,
  `payload` JSON NULL,
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME NULL,
  `id_users_recipient` INT NULL,
  PRIMARY KEY (`id_absenteeism_alert_notifications`),
  KEY `IDX_absenteeism_notif_alert` (`id_absenteeism_alerts`),
  KEY `IDX_absenteeism_notif_recipient` (`id_users_recipient`),
  KEY `IDX_absenteeism_notif_read` (`read_at`),
  CONSTRAINT `FK_absenteeism_notif_alert`
    FOREIGN KEY (`id_absenteeism_alerts`) REFERENCES `absenteeism_alerts` (`id_absenteeism_alerts`)
    ON DELETE CASCADE,
  CONSTRAINT `FK_absenteeism_notif_recipient`
    FOREIGN KEY (`id_users_recipient`) REFERENCES `users` (`id_users`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
