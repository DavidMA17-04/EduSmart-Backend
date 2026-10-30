# Integración de portales por rol — 2026-10-30

Change: `integrate-development-role-portals`. Rama de integración: `Feature-Aaron` en Backend y Frontend. La API conserva `/api/v1`; las seis casas son rutas del SPA, no fuentes de autorización del servidor.

## Esquema y permisos

La migración histórica `029_communications_module.sql` de Development elimina tablas. **No se usa para actualizar una instalación existente.** El runner histórico 029 ahora delega en la vía compatible, sin ejecutar ese SQL.

Desde la carpeta Backend:

```powershell
node scripts/apply-communications-upgrade.mjs
node scripts/apply-communications-upgrade.mjs --apply
node scripts/apply-migration-031.mjs
```

El primer comando solo diagnostica. `--apply` crea tablas ausentes o adapta esquemas admitidos, verifica referencias y conserva registros. Autoría ausente en datos antiguos o referencias no convertibles bloquean el prechequeo; no se inventa un autor ni se borran filas. El resultado informa etapas completadas y etapa interrumpida si falla. La reparación de roles antes llamada 029 es ahora `031_restore_operational_role_permissions.sql`; ejecutarla de nuevo no duplica asignaciones.

Orden: actualización de comunicados 030, después reparación operativa 031. Mantener `DB_SYNCHRONIZE=false` durante la actualización y uso del esquema migrado. El backup de BD debe ser restaurable y la actualización debe comprobarse en una BD aislada antes de aplicarla a la habitual. Los respaldos de BD y credenciales no se versionan.

Ante un fallo de DDL, detener escrituras y conservar el diagnóstico. Restaurar el respaldo en una BD nueva y verificarla antes de seleccionar la copia restaurada para la aplicación; una transacción MySQL no revierte automáticamente todo el esquema.

## Acceso

- Administrador y Director: cinco permisos de comunicados. Docente: ver, crear y publicar. Estudiante y Encargado: ver. Orientador conserva su plantilla disciplinaria sin asignación nueva de comunicados.
- Menú, restablecimiento, catálogo y asignaciones de fábrica comparten esa matriz. La UI reconoce las acciones específicas y no las sintetiza para otros módulos.
- Feed y lectura/acuse verifican audiencia, matrícula activa y representados; métricas y edición verifican autoría o gestión autorizada. Los alias institucionales se comparan como nombres equivalentes, sin coincidencia por substring.
- El centro usa `/disciplinary/appeals` y las políticas existentes de propio, representado y responsabilidad. No usa el stub `/appeals`.

## Comprobaciones

```powershell
node scripts/test-communications-upgrade.mjs --database=edusmart_qa_identificador
```

Este test rechaza cualquier BD que no empiece por `edusmart_qa_`; crea fixtures únicamente en esa BD aislada. Comprueba instalación, actualización, preservación, repetición y bloqueo de datos no convertibles. El script de QA de workspace `scripts/qa-role-portals.mjs` prueba API y navegador en los puertos aislados 3101/5175, con correo desactivado. Genera sus credenciales solo en memoria y no modifica cuentas de la BD habitual. Ver los resultados del change y [[Registro de QA]] para alcance ejecutado.

Los seeds continúan siendo comandos explícitos. `seed-demo-flow.mjs` simula con rollback por defecto y no sustituye la reparación de permisos.
