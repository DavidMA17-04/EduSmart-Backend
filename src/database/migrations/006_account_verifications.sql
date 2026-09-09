-- PBI-16: Account verification codes (one-time, hashed, expiring).
-- Do not edit migrations 001-005.

CREATE TABLE IF NOT EXISTS `account_verifications` (
  `id_account_verifications` INT NOT NULL AUTO_INCREMENT,
  `id_users` INT NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `last_sent_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_account_verifications`),
  KEY `IDX_account_verifications_user` (`id_users`),
  CONSTRAINT `FK_account_verifications_user`
    FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
