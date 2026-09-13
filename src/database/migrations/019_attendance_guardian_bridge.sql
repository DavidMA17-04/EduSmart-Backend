-- PBI-27 cierre: puente Encargado → Estudiante compatible con `id_users`.
-- La tabla `student_guardians` usa uuid y su servicio es stub; este puente mínimo
-- permite resolver `isMyRepresented` sin reescribir el módulo students.
-- Idempotent where practical. Do not edit migrations 001-018.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `guardian_student_links` (
  `id_guardian_student_links` INT NOT NULL AUTO_INCREMENT,
  `id_users_guardian` INT NOT NULL COMMENT 'Usuario con rol Encargado',
  `id_users_student` INT NOT NULL COMMENT 'Usuario con rol Estudiante representado',
  `relationship` VARCHAR(50) NULL COMMENT 'Parentesco o vínculo declarado',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_guardian_student_links`),
  UNIQUE KEY `UQ_guardian_student_links_pair` (`id_users_guardian`, `id_users_student`),
  KEY `IDX_guardian_student_links_guardian` (`id_users_guardian`),
  KEY `IDX_guardian_student_links_student` (`id_users_student`),
  CONSTRAINT `FK_guardian_student_links_guardian`
    FOREIGN KEY (`id_users_guardian`) REFERENCES `users` (`id_users`)
    ON DELETE CASCADE,
  CONSTRAINT `FK_guardian_student_links_student`
    FOREIGN KEY (`id_users_student`) REFERENCES `users` (`id_users`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed de QA local (idempotente): requiere usuario Encargado + Estudiante existentes.
-- En este entorno se sembraron vía script:
--   encargado.demo@edusmart.test → natalia.cordero1@edusmart.test
-- INSERT INTO `guardian_student_links` (`id_users_guardian`, `id_users_student`, `relationship`)
-- SELECT g.`id_users`, s.`id_users`, 'Madre/Padre'
-- FROM `users` g, `users` s
-- WHERE g.`email` = 'encargado.demo@edusmart.test'
--   AND s.`email` = 'natalia.cordero1@edusmart.test'
--   AND NOT EXISTS (
--     SELECT 1 FROM `guardian_student_links` l
--     WHERE l.`id_users_guardian` = g.`id_users`
--       AND l.`id_users_student` = s.`id_users`
--   );
