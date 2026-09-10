-- Sprint 2 / EP-02: password reset tokens and active sessions (PBI-18, PBI-22).
-- Do not edit migrations 001-006.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id_password_reset_tokens` INT NOT NULL AUTO_INCREMENT,
  `id_users` INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_password_reset_tokens`),
  KEY `IDX_password_reset_tokens_user` (`id_users`),
  KEY `IDX_password_reset_tokens_hash` (`token_hash`),
  CONSTRAINT `FK_password_reset_tokens_user`
    FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id_user_sessions` INT NOT NULL AUTO_INCREMENT,
  `id_users` INT NOT NULL,
  `refresh_token_hash` VARCHAR(255) NOT NULL,
  `user_agent` VARCHAR(500) NULL,
  `ip_address` VARCHAR(45) NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL,
  `last_used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_user_sessions`),
  KEY `IDX_user_sessions_user` (`id_users`),
  CONSTRAINT `FK_user_sessions_user`
    FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
