# Presentación universitaria — seed de datos ficticios

Script: `scripts/seed-presentacion-universitaria.mjs`

## Identificadores ficticios

| Concepto | Convención |
|----------|------------|
| Cédulas | Prefijo reservado **`801099`** + 3 dígitos (9 dígitos en total; compatible con login 9–12 dígitos) |
| Correos | `*@example.invalid` (RFC 2606) |
| Marcador interno | `PU-SEED` en descripciones / motivos (no en títulos visibles de comunicados) |
| Idempotencia alertas | `pres_univ_*` |

## Modos

```powershell
cd backend
$env:PRESENTACION_DEMO_PASSWORD = '********'   # solo para --apply; mín. 12 caracteres

node scripts/seed-presentacion-universitaria.mjs --dry-run
node scripts/seed-presentacion-universitaria.mjs --apply
node scripts/seed-presentacion-universitaria.mjs --rollback
```

- **`--dry-run`**: valida esquema, roles, colisiones y emite el plan JSON. **No escribe**.
- **`--apply`**: inserta en transacción y guarda `scripts/.manifest-presentacion-universitaria.json`.
- **`--rollback`**: elimina **solo** IDs del manifiesto (no toca usuarios fuera del prefijo `801099`).

## GitHub Actions (recomendado si TLS local falla)

Ver `scripts/GITHUB_ACTIONS_PRESENTACION.md` y workflow `.github/workflows/edusmart-presentacion-datos.yml`.

Operaciones: `inspect` → `dry-run` → `apply` (con confirmación).

## Conexión Aiven (cuando autorice la carga)

1. Preferir **GitHub Actions** con secretos `DB_*` + `DB_SSL_CA`, o Render Shell si está disponible.
2. Verificar backup reciente en consola Aiven.
3. Inventario read-only previo (conteos y colisiones).
4. `--dry-run` → revisión del JSON.
5. Exportar `PRESENTACION_DEMO_PASSWORD` en la sesión (no commitear).
6. `--apply` → conservar manifiesto en lugar seguro.
7. Validar pantallas con usuarios del prefijo `801099` (cambio de contraseña forzado en primer acceso).

## Periodos lectivos

- Crea años **2025 / 2026 / 2027** y períodos asociados si faltan.
- **No promueve ni cierra** períodos `ACTIVE` existentes.
- Los datos transaccionales usan **I semestre 2026** si existe; si no, el primer período `ACTIVE` detectado.

## Reversión

Orden inverso de dependencias (salidas → comunicados → disciplina → asistencia → académico → usuarios seed).

Tras rollback, revisar que `disciplinary_case_sequences` no requiera ajuste manual si se eliminaron expedientes de prueba.

## Pruebas automatizadas (sin BD)

```powershell
node --test scripts/seed-presentacion-universitaria.spec.mjs
```

## Escenarios de demostración sugeridos

| # | Rol | Ruta / acción |
|---|-----|----------------|
| 1 | Administrador | Períodos, especialidades, secciones/grupos |
| 2 | Docente | Horario institucional, nueva sesión de asistencia |
| 3 | Estudiante | Historial de asistencia y justificación pendiente |
| 4 | Encargado | Asistencia del representado, comunicado con acuse |
| 5 | Orientador | Expedientes disciplinarios y proceso |
| 6 | Encargado | Centro de apelaciones (`/discipline/appeals`) |
| 7 | Director | Publicación de comunicados |
| 8 | Guarda | Check-out y permisos de salida |

## Condiciones previas en Aiven (checklist)

- [ ] Backup automático reciente documentado.
- [ ] Inventario: usuarios totales y ausencia de cédulas `801099*` previas (re-ejecución idempotente vs colisión).
- [ ] Roles requeridos: Docente, Estudiante, Padre de familia/Encargado, Orientador, Director, Guarda de Seguridad.
- [ ] Tablas de migraciones 008–032 presentes (`schedule_time_slots` con franjas activas).
- [ ] Período operativo identificado (ACTIVE actual vs creación de I semestre 2026).
- [ ] TLS accesible desde el host de ejecución (Render Shell recomendado).
- [ ] `PRESENTACION_DEMO_PASSWORD` definido solo en sesión.
- [ ] Manifiesto anterior archivado si hubo un apply previo de prueba.

## Riesgos

- **No ejecutar** `seed-demo-dataset.mjs` ni `seed-disciplinary-actors.mjs` en la misma base (actualizan contraseñas).
- Duplicar nombres de especialidades ya existentes en prod: el script reutiliza filas por `name` único.
- Archivos de evidencia usan rutas simuladas; la descarga en UI puede no aplicar.
