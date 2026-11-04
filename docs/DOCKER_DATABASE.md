# Base de datos con Docker

EduSmart puede usar MySQL dentro de un contenedor Docker en lugar del MySQL instalado en Windows. Los dos pueden convivir: el contenedor publica el puerto **3307** y el MySQL local sigue en **3306**.

## Requisitos

1. Instalar **Docker Desktop** (https://www.docker.com/products/docker-desktop/) y abrirlo hasta que diga *Engine running*.
2. Verificar en una terminal:
   ```bash
   docker --version
   docker compose version
   ```

## Primera vez (base nueva y vacía)

Desde la carpeta `backend`:

```bash
npm run db:setup
```

Esto:
1. Levanta el contenedor `edusmart-mysql` (MySQL 8.4, utf8mb4) y espera a que esté sano.
2. Crea la base (`DB_DATABASE`, con la contraseña `DB_PASSWORD` de `.env`).
3. Aplica **todas** las migraciones en orden y las registra en la tabla `schema_migrations`.

Después, para que el backend use el contenedor, en `backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3307
```

Arranque el backend (`npm run start:dev`). Al iniciar crea el administrador definido en `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Datos de prueba opcionales (docentes, estudiantes, encargado y guarda; contraseña `TempPass12`):

```bash
npm run db:seed:demo
```

El guarda de caseta queda como `jsolis@edusmart.test` (cédula 300000040).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run db:up` | Enciende el contenedor y espera a que esté listo |
| `npm run db:down` | Apaga el contenedor (los datos se conservan en el volumen `edusmart_mysql_data`) |
| `npm run db:logs` | Muestra el log de MySQL |
| `npm run db:migrate` | Aplica solo las migraciones pendientes |
| `npm run db:status` | Lista migraciones aplicadas y pendientes |
| `npm run db:setup` | `db:up` + `db:migrate` |

Para borrar por completo la base del contenedor y empezar de cero: `docker compose down -v` (elimina el volumen; **irreversible**).

## Base existente (MySQL local en 3306)

El migrador **no ejecuta nada** sobre una base que ya tiene tablas pero no tiene registro de migraciones: algunas migraciones antiguas (por ejemplo la 029) recrean tablas y borrarían datos.

Si su base local ya tiene aplicadas las migraciones hasta la 031, regístrelas una sola vez sin ejecutarlas y aplique la 032 (control de salidas):

```bash
npm run db:status                              # revisar
node scripts/db-migrate.mjs --baseline-through=031
```

A partir de ahí `npm run db:migrate` aplicará solo lo nuevo. La migración 032 es idempotente (no usa DROP ni TRUNCATE).

Haga un respaldo antes de migrar una base con datos reales:

```bash
mysqldump -u root -p edusmart > respaldo-edusmart.sql
```

## Variables

| Variable | Uso | Valor por defecto |
|---|---|---|
| `DOCKER_DB_PORT` | Puerto del host que publica el contenedor | `3307` |
| `DB_PORT` | Puerto al que se conectan el backend y el migrador | (de `.env`) |
| `DB_DATABASE` | Nombre de la base creada en el contenedor | `EduSmart` |
| `DB_PASSWORD` | Contraseña de `root` en el contenedor | `changeme` |

> `MYSQL_ROOT_PASSWORD` solo se aplica la primera vez que se crea el volumen. Si cambia `DB_PASSWORD` después, use `docker compose down -v` (borra los datos) o cambie la contraseña dentro de MySQL.

## Problemas frecuentes

- **`ECONNREFUSED`**: el contenedor no está encendido o `DB_PORT` no es 3307. Ejecute `npm run db:up`.
- **`port is already allocated`**: otro programa usa el 3307. Ponga `DOCKER_DB_PORT=3308` en `.env` y `DB_PORT=3308`.
- **`Access denied for user 'root'`**: el volumen se creó con otra contraseña (ver nota anterior).
