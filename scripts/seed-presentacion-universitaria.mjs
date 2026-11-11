/**
 * Seed integral para demostración universitaria — CTP Hojancha.
 *
 * Uso:
 *   node scripts/seed-presentacion-universitaria.mjs --inspect
 *   node scripts/seed-presentacion-universitaria.mjs --dry-run
 *   node scripts/seed-presentacion-universitaria.mjs --apply
 *   node scripts/seed-presentacion-universitaria.mjs --rollback [--manifest path]
 *
 * Requiere variables DB_* (y DB_SSL_CA_FILE en Aiven). Contraseña de usuarios nuevos:
 *   PRESENTACION_DEMO_PASSWORD (mín. 12 caracteres) — solo al ejecutar --apply.
 *
 * No actualiza usuarios existentes ni sus contraseñas.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { dbSslFromEnv } from './lib/db-ssl.mjs';
import { dryRunPlanSummary } from './lib/presentacion-universitaria/constants.mjs';
import { validateDatabase, validateEnvironmentHost, validatePersonasStatic } from './lib/presentacion-universitaria/validate.mjs';
import { applyPresentationSeed } from './lib/presentacion-universitaria/apply.mjs';
import { rollbackFromManifest } from './lib/presentacion-universitaria/rollback.mjs';
import { loadManifest, resolveManifestPath, saveManifest } from './lib/presentacion-universitaria/manifest.mjs';
import { runPresentationInspect } from './lib/presentacion-universitaria/inspect.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });

const args = process.argv.slice(2);
const INSPECT = args.includes('--inspect');
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-run');
const ROLLBACK = args.includes('--rollback');
const APPLY_CONFIRM_ENV = 'CONFIRM_PRESENTACION_APPLY';
const manifestArg = args.find((a) => a.startsWith('--manifest='))?.split('=')[1];

function usage() {
  console.log(`Uso:
  node scripts/seed-presentacion-universitaria.mjs --inspect
  node scripts/seed-presentacion-universitaria.mjs --dry-run
  node scripts/seed-presentacion-universitaria.mjs --apply
  node scripts/seed-presentacion-universitaria.mjs --rollback [--manifest=scripts/.manifest-presentacion-universitaria.json]`);
}

async function runInspect(conn) {
  const report = await runPresentationInspect(conn);
  console.log(JSON.stringify(report, null, 2));
}

async function connect() {
  const ssl = dbSslFromEnv(process.env, { servername: process.env.DB_HOST });
  return mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'EduSmart',
    ssl,
    multipleStatements: false,
  });
}

async function runDryRun(conn) {
  validatePersonasStatic();
  const summary = dryRunPlanSummary();
  const validation = await validateDatabase(conn);
  console.log(JSON.stringify({
    mode: 'dry-run',
    environment: validateEnvironmentHost(),
    plan: summary,
    validation,
  }, null, 2));
  if (!validation.ok) {
    console.error('Validación con bloqueos. Corrija antes de --apply.');
    process.exit(1);
  }
  console.log('Dry-run completado: sin escrituras.');
}

async function runApply(conn) {
  const confirm = process.env[APPLY_CONFIRM_ENV]?.trim();
  if (confirm !== 'APLICAR_PRESENTACION') {
    throw new Error(
      `Apply bloqueado. Defina ${APPLY_CONFIRM_ENV}=APLICAR_PRESENTACION en el entorno de ejecución.`,
    );
  }
  validatePersonasStatic();
  const validation = await validateDatabase(conn);
  if (!validation.ok) {
    console.error(JSON.stringify(validation, null, 2));
    throw new Error('Validación fallida; no se aplicó el seed.');
  }
  const manifest = await applyPresentationSeed(conn, validation, console.log);
  const manifestPath = resolveManifestPath(projectRoot, manifestArg);
  saveManifest(manifestPath, manifest);
  console.log(`Manifiesto guardado: ${manifestPath}`);
  console.log(JSON.stringify({ applied: true, counts: Object.fromEntries(
    Object.entries(manifest).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]),
  ) }, null, 2));
}

async function runRollback(conn) {
  const manifestPath = resolveManifestPath(projectRoot, manifestArg);
  const manifest = loadManifest(manifestPath);
  const result = await rollbackFromManifest(conn, manifest, { dryRun: false });
  console.log(JSON.stringify({ rollback: true, steps: result.steps, manifestPath }, null, 2));
}

async function main() {
  if (!INSPECT && !DRY && !APPLY && !ROLLBACK) {
    usage();
    process.exit(0);
  }
  const modes = [INSPECT, DRY, APPLY, ROLLBACK].filter(Boolean).length;
  if (modes !== 1) {
    throw new Error('Use un solo modo: --inspect, --dry-run, --apply o --rollback');
  }

  if (!process.env.DB_SSL?.trim()) {
    process.env.DB_SSL = 'true';
  }

  const conn = await connect();
  try {
    if (INSPECT) await runInspect(conn);
    else if (DRY) await runDryRun(conn);
    else if (APPLY) await runApply(conn);
    else if (ROLLBACK) await runRollback(conn);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.code ?? 'SEED_ERROR', message: err.message }));
  process.exit(1);
});
