-- Specialty belongs to the classroom section (groups), not the academic level (sections).
SET NAMES utf8mb4;

ALTER TABLE `groups`
  ADD COLUMN `id_specialties` INT NULL AFTER `id_sections`,
  ADD CONSTRAINT `FK_groups_specialties`
    FOREIGN KEY (`id_specialties`) REFERENCES `specialties` (`id_specialties`) ON DELETE SET NULL;

UPDATE `groups` g
INNER JOIN `sections` s ON s.id_sections = g.id_sections
SET g.id_specialties = s.id_specialties
WHERE s.id_specialties IS NOT NULL;
