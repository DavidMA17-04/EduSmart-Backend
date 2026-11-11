# GitHub Actions — Presentación universitaria (Aiven)

Workflow: `.github/workflows/edusmart-presentacion-datos.yml`

## Secretos del repositorio (Settings → Secrets and variables → Actions)

| Secreto | Uso |
|---------|-----|
| `DB_HOST` | Host Aiven (sin credenciales en logs) |
| `DB_PORT` | Puerto TLS MySQL |
| `DB_USERNAME` | Usuario (p. ej. `avnadmin`) |
| `DB_PASSWORD` | Contraseña |
| `DB_DATABASE` | Base efectiva (`defaultdb` o la de Render) |
| `DB_SSL_CA` | PEM completo del CA Aiven (puede usar `\\n` en una línea) |
| `PRESENTACION_DEMO_PASSWORD` | Solo para **apply** futuro; bcrypt de usuarios `801099*` |
| `PRESENTACION_DEMO_LOGIN_READY` | Opcional: `true` → nuevos usuarios con `must_change_password=0` |

No commitear secretos. No imprimir variables en el workflow.

## Ejecución manual

1. Repositorio **EduSmart-Backend** en GitHub.
2. **Actions** → *EduSmart — Presentación datos (Aiven)* → **Run workflow**.
3. Elegir rama con el script (tras su push autorizado).
4. Operación:
   - **inspect** — TLS + inventario + colisiones (solo lectura).
   - **dry-run** — validación + plan JSON (sin INSERT).
   - **apply** — solo tras autorización; campo `confirm_apply` = `APLICAR_PRESENTACION`.

## Orden recomendado

1. `inspect` → revisar JSON (usuarios, períodos, `usersWithPrefix801099`).
2. `dry-run` → debe terminar con `validation.ok: true`.
3. Backup Aiven documentado.
4. `apply` con confirmación → descargar **artifact** del manifiesto.

## Reversión

```bash
# Con manifiesto del artifact, en un job manual futuro o local con TLS:
node scripts/seed-presentacion-universitaria.mjs --rollback --manifest=scripts/.manifest-presentacion-universitaria.json
```

El rollback usa **IDs del manifiesto**; validación extra de prefijo `801099` antes de borrar usuarios.

## Checklist dashboard post-carga

- Usuarios / roles en directorio admin.
- Años y períodos (2025–2027).
- Especialidades + talleres exploratorios.
- Secciones / grupos / matrículas.
- Horario institucional y mi horario.
- Asistencia, justificaciones, alertas.
- Disciplina y centro de apelaciones.
- Comunicados y lecturas.
- Salidas (guarda).
- Reportes administrativos exportables.

## Cuentas de demostración

| Rol | En el dataset |
|-----|----------------|
| Administrador | **No** se crea ficticio (evitar choque con `100000000`). Usar admin institucional real en el panel. |
| Docente / Estudiante / Encargado | 9 / 35 / 25 usuarios `801099*` |
| Orientador / Director / Guarda | Un usuario cada uno (`801099401`–`403`) |

Login: cédula de 9 dígitos + `PRESENTACION_DEMO_PASSWORD`. Con `PRESENTACION_DEMO_LOGIN_READY=true` no redirige a cambio obligatorio de contraseña en el primer acceso (solo usuarios **nuevos** insertados por el seed).

## Seguridad del workflow

- `workflow_dispatch` únicamente (sin triggers en push/PR).
- `permissions: contents: read`.
- Timeout 20 minutos.
- `concurrency` evita dos cargas simultáneas.
- Apply exige `APLICAR_PRESENTACION` + `CONFIRM_PRESENTACION_APPLY` en el script.
- Recomendado: **GitHub Environment** `production` con aprobación manual en el paso apply (configuración del repo).

## Riesgos antes del primer apply

- Colisiones si ya existen cédulas `801099*` o correos `@example.invalid`.
- Período ACTIVE distinto de I semestre 2026 (el seed no lo cambia; datos van al período operativo detectado).
- Nombres de especialidades duplicados en prod (reutiliza fila existente por `name`).
- Manifiesto perdido → rollback más difícil (conservar artifact 90 días).
- TLS desde GitHub suele funcionar aunque falle desde PC local; verificar con **inspect** primero.
