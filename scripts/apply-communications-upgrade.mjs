import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { upgradeCommunications } from './lib/communications-upgrade.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE,
  multipleStatements: true,
});
try {
  console.log(JSON.stringify(await upgradeCommunications(db, { apply: process.argv.includes('--apply') })));
} catch (error) {
  console.error(JSON.stringify({ result: 'failed', code: error.code ?? 'UPGRADE_FAILED',
    message: error.code ? 'Fallo de base de datos: revisar diagnóstico y respaldo antes de continuar.' : error.message,
    state: error.upgradeState ?? { completedStages: [], interruptedStage: 'preflight', mayBePartiallyApplied: false } }));
  process.exitCode = 1;
} finally {
  await db.end();
}
