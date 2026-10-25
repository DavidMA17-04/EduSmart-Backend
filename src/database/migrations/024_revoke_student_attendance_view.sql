-- QA / guía WF-43/44: Estudiante no debe tener attendance.view
-- (solo Ingresar código + view_own/justify; sin reportes/alertas/hub institucional).
-- Idempotente. No toca Encargado ni Docente.

SET NAMES utf8mb4;

DELETE rp
FROM `role_permissions` rp
INNER JOIN `roles` r ON r.`id_roles` = rp.`id_roles`
INNER JOIN `permissions` p ON p.`id_permissions` = rp.`id_permissions`
WHERE r.`name` = 'Estudiante'
  AND p.`code` = 'attendance.view';
