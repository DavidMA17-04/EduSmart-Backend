-- PBI-27: una justificación aprobada marca la asistencia como JUSTIFIED.
-- Corrige registros aprobados antes del cambio (quedaron ABSENT + JUSTIFIED).
-- Idempotente: la segunda ejecución no encuentra filas.

SET NAMES utf8mb4;

UPDATE `attendance` a
INNER JOIN `absence_justifications` j
  ON j.`id_attendance` = a.`id_attendance`
 AND j.`status` = 'APPROVED'
SET a.`status` = 'JUSTIFIED'
WHERE a.`status` = 'ABSENT'
  AND a.`justification_status` = 'JUSTIFIED';
