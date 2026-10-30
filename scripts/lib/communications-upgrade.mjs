import fs from 'node:fs';
import crypto from 'node:crypto';

const tables = ['communications', 'communication_recipients', 'communication_reads'];
const qi = (s) => '`' + String(s).replaceAll('`', '``') + '`';
const count = async (db, sql) => Number((await db.query(sql))[0][0].total);
const fail = (message) => { throw new Error(`COMMUNICATIONS_PREFLIGHT: ${message}`); };

async function metadata(db) {
  const [rows] = await db.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME IN ('communications','communication_recipients','communication_reads')`);
  return Object.fromEntries(tables.map(t => [t, Object.fromEntries(rows
    .filter(r => r.TABLE_NAME === t).map(r => [r.COLUMN_NAME, r]))]));
}

/** Validate every legacy reference before running any DDL. */
export async function preflightCommunications(db) {
  const meta = await metadata(db);
  const counts = {};
  for (const t of tables) counts[t] = Object.keys(meta[t]).length
    ? await count(db, `SELECT COUNT(*) total FROM ${qi(t)}`) : 0;
  const comm = meta.communications, recipients = meta.communication_recipients, reads = meta.communication_reads;
  if (counts.communications) {
    if (!comm.author_id || (!comm.content && !comm.body)) fail('comunicados sin autoría o contenido convertible');
    if (await count(db, `SELECT COUNT(*) total FROM communications c LEFT JOIN users u
      ON CAST(c.author_id AS CHAR)=CAST(u.id_users AS CHAR) WHERE u.id_users IS NULL`)) fail('autoría sin usuario real');
    if (await count(db, `SELECT COUNT(*) total FROM communications WHERE status NOT IN ('DRAFT','PUBLISHED','ARCHIVED')`)) fail('estado de comunicado desconocido');
  }
  if (counts.communication_recipients) {
    if (!counts.communications || !recipients.recipient_type || (!recipients.target_id && !recipients.recipient_id)) fail('destinatarios sin esquema o padre válido');
    if (await count(db, `SELECT COUNT(*) total FROM communication_recipients r LEFT JOIN communications c
      ON c.id=r.communication_id WHERE c.id IS NULL`)) fail('destinatarios huérfanos');
    if (await count(db, `SELECT COUNT(*) total FROM communication_recipients WHERE recipient_type NOT IN ('ALL','ROLE','GROUP','USER')`)) fail('tipo de destinatario desconocido');
    const target = recipients.target_id ? 'target_id' : 'recipient_id';
    if (await count(db, `SELECT COUNT(*) total FROM communication_recipients WHERE recipient_type<>'ALL'
      AND (${qi(target)} IS NULL OR TRIM(${qi(target)})='')`)) fail('destinatario sin referencia');
    for (const [type, table, key] of [['USER','users','id_users'],['GROUP','groups','id_groups'],['ROLE','roles','name']]) {
      if (await count(db, `SELECT COUNT(*) total FROM communication_recipients r LEFT JOIN ${qi(table)} p
        ON CAST(r.${qi(target)} AS CHAR)=CAST(p.${qi(key)} AS CHAR)
        WHERE r.recipient_type='${type}' AND p.${qi(key)} IS NULL`)) fail(`destinatario ${type} sin referencia real`);
    }
  }
  if (counts.communication_reads) {
    if (!counts.communications || !reads.user_id || !reads.read_at) fail('lecturas sin esquema o padre válido');
    if (await count(db, `SELECT COUNT(*) total FROM communication_reads r LEFT JOIN users u
      ON CAST(r.user_id AS CHAR)=CAST(u.id_users AS CHAR) LEFT JOIN communications c ON c.id=r.communication_id
      WHERE u.id_users IS NULL OR c.id IS NULL`)) fail('lecturas con referencias no convertibles');
    if (await count(db, `SELECT COUNT(*) total FROM (SELECT communication_id,user_id FROM communication_reads
      GROUP BY communication_id,user_id HAVING COUNT(*)>1) duplicates`)) fail('lecturas duplicadas: requieren reconciliación explícita');
  }
  return { meta, counts };
}

async function fingerprint(db, meta) {
  const result = {};
  for (const t of tables) {
    const cols = Object.keys(meta[t]);
    if (!cols.length) { result[t] = []; continue; }
    const projection = cols.map(c => {
      const canonical = c === 'body' ? 'content' : c === 'recipient_id' ? 'target_id' : c;
      return `${qi(c)} AS ${qi(canonical)}`;
    }).join(',');
    result[t] = (await db.query(`SELECT ${projection} FROM ${qi(t)} ORDER BY id`))[0];
  }
  return result;
}
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows, (_key, value) =>
  typeof value === 'number' ? String(value) : value)).digest('hex');

export async function upgradeCommunications(db, { apply = false } = {}) {
  const { meta, counts } = await preflightCommunications(db);
  const before = await fingerprint(db, meta);
  if (!apply) return { mode: 'diagnostic', migration: '030_communications_preserving_upgrade', counts };

  const sql = fs.readFileSync(new URL('../../src/database/migrations/030_communications_preserving_upgrade.sql', import.meta.url), 'utf8');
  const permissionStart = sql.indexOf('-- 3. Catálogo');
  const collation = meta.communications.id?.COLLATION_NAME ?? 'utf8mb4_unicode_ci';
  if (!/^[a-zA-Z0-9_]+$/.test(collation)) fail('collation no admitida');
  const [[action]] = await db.query(`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permissions' AND COLUMN_NAME='action'`);
  const values = [...action.COLUMN_TYPE.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const actions = [...new Set([...values, 'VIEW','CREATE','EDIT','DELETE','EXPORT','CONFIGURE','VIEW_OWN','JUSTIFY','REVIEW','RESOLVE','APPEAL','PRECAUTIONARY','RESPOND','PUBLISH','MANAGE','STATS'])];
  if (actions.some(v => !/^[A-Z_]+$/.test(v))) fail('catálogo de acciones no admitido');
  const charset = collation.split('_')[0];
  const completedStages = [];
  let stage = 'create_missing_tables';
  try {
  await db.query(sql.slice(0, permissionStart).replaceAll('DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci', `DEFAULT CHARSET=${charset} COLLATE=${collation}`));
  completedStages.push(stage);
  stage = 'align_columns';
  let current = await metadata(db);
  const add = async (table, column, definition) => {
    if (!current[table][column]) await db.query(`ALTER TABLE ${qi(table)} ADD COLUMN ${qi(column)} ${definition}`);
  };
  if (current.communications.body && !current.communications.content) {
    await db.query('ALTER TABLE communications CHANGE COLUMN body content LONGTEXT NOT NULL');
  }
  if (current.communication_recipients.recipient_id && !current.communication_recipients.target_id) {
    await db.query('ALTER TABLE communication_recipients CHANGE COLUMN recipient_id target_id VARCHAR(100) NULL');
  }
  current = await metadata(db);
  await db.query('ALTER TABLE communications MODIFY COLUMN title VARCHAR(255) NOT NULL');
  await add('communications', 'content', 'LONGTEXT NOT NULL');
  await add('communications', 'priority', "ENUM('URGENT','IMPORTANT','NORMAL') NOT NULL DEFAULT 'NORMAL'");
  await add('communications', 'requires_acknowledgment', 'TINYINT(1) NOT NULL DEFAULT 0');
  await add('communications', 'publish_date', 'DATETIME NULL');
  await add('communications', 'expiration_date', 'DATETIME NULL');
  await add('communications', 'author_id', 'INT NOT NULL');
  await add('communication_recipients', 'target_id', 'VARCHAR(100) NULL');
  await add('communication_recipients', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await add('communication_reads', 'acknowledged_at', 'DATETIME NULL');
  current = await metadata(db);
  for (const [table, column] of [['communications','author_id'],['communication_reads','user_id']]) {
    if (!/^int(?:\(|$)/.test(current[table][column].COLUMN_TYPE)) await db.query(`ALTER TABLE ${qi(table)} MODIFY COLUMN ${qi(column)} INT NOT NULL`);
  }
  completedStages.push(stage);
  stage = 'permissions';
  await db.query(`ALTER TABLE permissions MODIFY COLUMN action ENUM(${actions.map(v => `'${v}'`).join(',')}) NOT NULL`);
  await db.query(sql.slice(permissionStart));
  completedStages.push(stage);
  stage = 'keys';
  const [indices] = await db.query('SHOW INDEX FROM communication_reads');
  const uniqueRead = new Map();
  for (const index of indices.filter(i => !i.Non_unique)) {
    const columns = uniqueRead.get(index.Key_name) ?? [];
    columns[index.Seq_in_index - 1] = index.Column_name;
    uniqueRead.set(index.Key_name, columns);
  }
  if (![...uniqueRead.values()].some(columns => columns.join(',') === 'communication_id,user_id')) {
    await db.query('ALTER TABLE communication_reads ADD UNIQUE KEY uq_comm_user_read (communication_id,user_id)');
  }
  const [foreignKeys] = await db.query(`SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`);
  for (const [table, column, parent, key] of [
    ['communications','author_id','users','id_users'],
    ['communication_recipients','communication_id','communications','id'],
    ['communication_reads','communication_id','communications','id'],
    ['communication_reads','user_id','users','id_users'],
  ]) {
    if (!foreignKeys.some(f => f.TABLE_NAME === table && f.COLUMN_NAME === column && f.REFERENCED_TABLE_NAME === parent && f.REFERENCED_COLUMN_NAME === key)) {
      await db.query(`ALTER TABLE ${qi(table)} ADD FOREIGN KEY (${qi(column)}) REFERENCES ${qi(parent)} (${qi(key)}) ON DELETE CASCADE`);
    }
  }
  completedStages.push(stage);
  stage = 'verify_preservation';
  const afterMeta = Object.fromEntries(tables.map(t => [t, Object.fromEntries(Object.entries(meta[t])
    .map(([c, v]) => [c === 'body' ? 'content' : c === 'recipient_id' ? 'target_id' : c, v]))]));
  const after = await fingerprint(db, afterMeta);
  if (digest(before) !== digest(after)) throw new Error('COMMUNICATIONS_VERIFY: datos previos cambiaron; conservar respaldo y revisar etapas');
  await preflightCommunications(db);
  completedStages.push(stage);
  return { mode: 'applied', migration: '030_communications_preserving_upgrade', counts, preserved: true, completedStages };
  } catch (error) {
    error.upgradeState = { completedStages, interruptedStage: stage, mayBePartiallyApplied: true };
    throw error;
  }
}
