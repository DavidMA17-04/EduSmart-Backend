-- Repair UTF-8 text corrupted when 001 was applied without SET NAMES utf8mb4.
-- Safe to run multiple times. Prefer: npm run db:repair-encoding

SET NAMES utf8mb4;

UPDATE `roles`
SET `description` = 'Acceso completo al módulo administrativo'
WHERE `name` = 'Administrador';

UPDATE `roles`
SET `description` = 'Personal docente. Puede asignarse como docente guía de una sección.'
WHERE `name` = 'Docente';

DELETE FROM `specialties`
WHERE `name` LIKE '%├%' OR `description` LIKE '%├%';

-- Permission descriptions are repaired by scripts/repair-utf8-data.mjs
-- or automatically on backend startup via Utf8RepairService.
