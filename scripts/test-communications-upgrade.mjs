import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { upgradeCommunications } from './lib/communications-upgrade.mjs';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
const database = process.argv.find(a => a.startsWith('--database='))?.slice('--database='.length);
if (!/^edusmart_qa_[a-zA-Z0-9_]+$/.test(database ?? '')) throw Error('Solo se admite una BD aislada edusmart_qa_*');
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database, multipleStatements: true });
const results = [];
const check = async (name, fn) => { await fn(); results.push({ name, status: 'Pass' }); };
const clear = async () => {
  // Only test fixtures in the explicitly guarded isolated database.
  await db.query('DROP TABLE IF EXISTS communication_reads; DROP TABLE IF EXISTS communication_recipients; DROP TABLE IF EXISTS communications');
};
const legacy = async () => {
  await clear();
  await db.query(`CREATE TABLE communications (id VARCHAR(36) PRIMARY KEY, title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,status VARCHAR(30) NOT NULL,author_id VARCHAR(36),created_at DATETIME(6),updated_at DATETIME(6));
    CREATE TABLE communication_recipients (id VARCHAR(36) PRIMARY KEY,communication_id CHAR(36),recipient_id CHAR(36),recipient_type VARCHAR(50));
    CREATE TABLE communication_reads (id VARCHAR(36) PRIMARY KEY,communication_id CHAR(36),user_id CHAR(36),read_at DATETIME(6));`);
};
try {
  await legacy();
  await check('Esquema antiguo vacío', async () => assert.equal((await upgradeCommunications(db, { apply: true })).preserved, true));
  await clear();
  await check('Instalación nueva y segunda ejecución', async () => {
    assert.equal((await upgradeCommunications(db, { apply: true })).preserved, true);
    assert.equal((await upgradeCommunications(db, { apply: true })).preserved, true);
  });
  await check('Dirección recibe cinco permisos de comunicados sin sintetizar acciones clásicas', async () => {
    await db.query("DELETE rp FROM role_permissions rp JOIN roles r ON r.id_roles=rp.id_roles JOIN permissions p ON p.id_permissions=rp.id_permissions WHERE r.name='Director' AND p.module='COMMUNICATIONS'");
    await upgradeCommunications(db, { apply: true });
    const [[row]] = await db.query("SELECT COUNT(*) n FROM role_permissions rp JOIN roles r ON r.id_roles=rp.id_roles JOIN permissions p ON p.id_permissions=rp.id_permissions WHERE r.name='Director' AND p.module='COMMUNICATIONS'");
    assert.equal(row.n, 5);
  });
  const [[user]] = await db.query('SELECT MIN(id_users) id FROM users');
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO communications(id,title,content,author_id,status) VALUES(?,?,?,?,'PUBLISHED')`, [id,'QA conservación','Contenido de prueba',user.id]);
  await db.query('INSERT INTO communication_recipients(id,communication_id,recipient_type,target_id) VALUES(?,?,?,?)', [crypto.randomUUID(),id,'USER',String(user.id)]);
  await db.query('INSERT INTO communication_reads(id,communication_id,user_id,acknowledged_at) VALUES(?,?,?,?)',[crypto.randomUUID(),id,user.id,'2026-10-29 12:34:56']);
  await check('Esquema compatible con contenido, destinatario, lectura y acuse', async () => {
    const result = await upgradeCommunications(db, { apply: true });
    assert.equal(result.counts.communications,1);assert.equal(result.counts.communication_reads,1);assert.equal(result.preserved,true);
  });
  await legacy();
  await db.query(`INSERT INTO communications VALUES(?,?,?,'PUBLISHED',?,'2026-10-29 11:22:33.123456','2026-10-29 11:22:33.123456')`,[id,'QA legado','Texto conservado',String(user.id)]);
  await db.query('INSERT INTO communication_recipients VALUES(?,?,?,?)',[crypto.randomUUID(),id,String(user.id),'USER']);
  await db.query("INSERT INTO communication_reads VALUES(?,?,?,'2026-10-29 12:34:56.123456')",[crypto.randomUUID(),id,String(user.id)]);
  await check('Conversión legado body/recipient_id y referencias reales', async () => {
    assert.equal((await upgradeCommunications(db,{apply:true})).preserved,true);
    const [[row]]=await db.query("SELECT content,author_id,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s.%f') stamp FROM communications");
    assert.equal(row.content,'Texto conservado');assert.equal(row.author_id,user.id);assert.equal(row.stamp,'2026-10-29 11:22:33.123456');
    assert.equal((await upgradeCommunications(db,{apply:true})).preserved,true);
  });
  await legacy();
  await db.query('ALTER TABLE communications DROP COLUMN author_id');
  await db.query("INSERT INTO communications VALUES(?,?,?,'DRAFT',NOW(),NOW())",[id,'QA sin autor','No borrar']);
  await check('Autoría ausente detiene el prechequeo sin cambiar el esquema', async () => {
    const before=(await db.query('SHOW CREATE TABLE communications'))[0];
    await assert.rejects(()=>upgradeCommunications(db,{apply:true}),/sin autoría/);
    assert.deepEqual((await db.query('SHOW CREATE TABLE communications'))[0],before);
  });
  await legacy();
  await db.query("INSERT INTO communications VALUES(?,?,?,'PUBLISHED',?,NOW(),NOW())",[id,'QA referencia','Texto',String(user.id)]);
  await db.query('INSERT INTO communication_reads VALUES(?,?,?,NOW())',[crypto.randomUUID(),id,crypto.randomUUID()]);
  await check('Lector no convertible no se atribuye a otro usuario', async () => {
    await assert.rejects(()=>upgradeCommunications(db,{apply:true}),/referencias no convertibles/);
  });
  await clear();
  await upgradeCommunications(db,{apply:true});
  await check('Reparación de roles 031 independiente e idempotente', async () => {
    const repair=fs.readFileSync(new URL('../src/database/migrations/031_restore_operational_role_permissions.sql',import.meta.url),'utf8');
    await db.query(repair);const [[a]]=await db.query('SELECT COUNT(*) n FROM role_permissions');await db.query(repair);const [[b]]=await db.query('SELECT COUNT(*) n FROM role_permissions');assert.equal(a.n,b.n);
  });
  console.log(JSON.stringify({ database, cases: results, total: results.length, result:'Pass' },null,2));
} finally {
  await db.end();
}
