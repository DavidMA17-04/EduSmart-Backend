/**
 * Migrador con registro (tabla `schema_migrations`) para EduSmart.
 *
 * Aplica, en orden, solo los archivos de src/database/migrations/*.sql que aún
 * no están registrados. Cada migración se ejecuta UNA vez por base de datos.
 *
 * Uso:
 *   node scripts/db-migrate.mjs                      aplica las pendientes
 *   node scripts/db-migrate.mjs --status             muestra aplicadas / pendientes
 *   node scripts/db-migrate.mjs --dry-run            lista lo que aplicaría, sin tocar nada
 *   node scripts/db-migrate.mjs --wait               espera hasta 120 s a que MySQL acepte conexiones
 *   node scripts/db-migrate.mjs --baseline-through=031
 *       Base existente sin registro: marca 001..031 como ya aplicadas (no las
 *       ejecuta) y luego aplica las posteriores.
 *
 * Seguridad: si la base YA tiene tablas pero no tiene `schema_migrations`, el
 * script se detiene sin ejecutar nada. Algunas migraciones antiguas (p. ej. 029)
 * recrean tablas y borrarían datos si se re-ejecutan sobre una base en uso.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '..', '.env'), quiet: true });

const MIGRATIONS_DIR = path.join(scriptDir, '..', 'src', 'database', 'migrations');

/**
 * Errores conocidos e inofensivos en una base nueva (mismo criterio que
 * bootstrap-local-db.js): la migración intenta algo que el esquema ya cumple.
 */
const BENIGN_ERRORS = {
  '002_drop_users_first_last_name.sql': ['ER_BAD_FIELD_ERROR', 'ER_CANT_DROP_FIELD_OR_KEY'],
  '005_group_specialty.sql': ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_FK_DUP_NAME'],
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'EduSmart',
};

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}

function checksum(content) {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  const deadline = Date.now() + (flag('wait') ? 120_000 : 0);
  for (;;) {
    try {
      const server = await mysql.createConnection({ ...config, database: undefined });
      await server.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await server.end();
      return await mysql.createConnection({ ...config, multipleStatements: true });
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      process.stdout.write('.');
      await sleep(2000);
    }
  }
}

async function tableExists(db, table) {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  return Number(rows[0].n) > 0;
}

async function userTableCount(db) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('schema_migrations', 'typeorm_metadata')`,
  );
  return Number(rows[0].n);
}

async function ensureTracking(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      mode ENUM('APPLIED', 'BASELINE') NOT NULL DEFAULT 'APPLIED',
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS typeorm_metadata (
      type varchar(255) NOT NULL,
      \`database\` varchar(255) DEFAULT NULL,
      \`schema\` varchar(255) DEFAULT NULL,
      \`table\` varchar(255) DEFAULT NULL,
      name varchar(255) DEFAULT NULL,
      value text
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function main() {
  const files = migrationFiles();
  const baselineThrough = option('baseline-through');
  if (baselineThrough !== undefined && !/^\d{1,3}$/.test(baselineThrough)) {
    throw new Error(
      '--baseline-through espera un número de migración, p. ej. --baseline-through=031',
    );
  }

  process.stdout.write(`Conectando a ${config.host}:${config.port}/${config.database} `);
  const db = await connect();
  console.log('ok');

  try {
    const tracked = await tableExists(db, 'schema_migrations');
    const existingTables = await userTableCount(db);

    const readOnly = flag('status') || flag('dry-run');
    if (!tracked && existingTables > 0 && baselineThrough === undefined && !readOnly) {
      console.error(`
La base "${config.database}" ya tiene ${existingTables} tablas pero no tiene registro de migraciones.
No se ejecutó nada: re-aplicar migraciones antiguas sobre una base con datos puede borrarlos.

Si esta base ya tiene aplicadas las migraciones hasta la 031, regístrelas sin ejecutarlas:
  node scripts/db-migrate.mjs --baseline-through=031
`);
      process.exitCode = 2;
      return;
    }

    if (!tracked && readOnly) {
      console.log(
        existingTables === 0
          ? 'Base vacía: se aplicarían todas las migraciones.'
          : `Base con ${existingTables} tablas y sin registro de migraciones. Use --baseline-through=NNN antes de migrar.`,
      );
      files.forEach((file) => console.log(`  pendiente  ${file}`));
      return;
    }
    if (!readOnly) await ensureTracking(db);

    if (baselineThrough !== undefined && !readOnly) {
      const limit = Number(baselineThrough);
      const toMark = files.filter((file) => Number(file.slice(0, 3)) <= limit);
      for (const file of toMark) {
        const sum = checksum(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
        await db.query(
          "INSERT IGNORE INTO schema_migrations (name, checksum, mode) VALUES (?, ?, 'BASELINE')",
          [file, sum],
        );
      }
      console.log(
        `Línea base: ${toMark.length} migraciones (hasta ${baselineThrough.padStart(3, '0')}) marcadas como aplicadas.`,
      );
    }

    const [rows] =
      tracked || !readOnly
        ? await db.query('SELECT name, checksum, mode FROM schema_migrations')
        : [[]];
    const applied = new Map(rows.map((row) => [row.name, row]));
    const pending = files.filter((file) => !applied.has(file));

    if (flag('status')) {
      for (const file of files) {
        const row = applied.get(file);
        const sum = checksum(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
        const state = row ? (row.mode === 'BASELINE' ? 'línea base' : 'aplicada  ') : 'pendiente ';
        const drift =
          row && row.mode === 'APPLIED' && row.checksum !== sum
            ? '  (archivo modificado después de aplicarse)'
            : '';
        console.log(`  ${state} ${file}${drift}`);
      }
      console.log(`\n${files.length - pending.length} aplicadas, ${pending.length} pendientes.`);
      return;
    }

    if (pending.length === 0) {
      console.log('La base está al día. No hay migraciones pendientes.');
      return;
    }

    if (flag('dry-run')) {
      console.log('Se aplicarían:');
      pending.forEach((file) => console.log(`  ${file}`));
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  aplicando ${file} ... `);
      try {
        await db.query(sql);
        console.log('ok');
      } catch (error) {
        if (BENIGN_ERRORS[file]?.includes(error.code)) {
          console.log(`ok (omitido: ${error.code}, el esquema ya lo cumple)`);
        } else {
          console.log('ERROR');
          console.error(`\n${file} falló: ${error.code ?? ''} ${error.message}`);
          console.error('Se detuvo la ejecución. Las migraciones anteriores quedaron registradas.');
          process.exitCode = 1;
          return;
        }
      }
      await db.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [
        file,
        checksum(sql),
      ]);
    }
    console.log(`\nListo: ${pending.length} migraciones aplicadas.`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`\nNo se pudo completar la migración: ${error.code ?? ''} ${error.message}`);
  if (error.code === 'ECONNREFUSED') {
    console.error('¿Está MySQL encendido? Con Docker: npm run db:up');
  }
  process.exit(1);
});
