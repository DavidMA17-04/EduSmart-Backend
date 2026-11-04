import mysql from 'mysql2/promise';

const PERMISSION_DESCRIPTIONS = {
  'administrator.view': 'Ver módulo administrativo',
  'administrator.create': 'Crear en módulo administrativo',
  'administrator.edit': 'Editar módulo administrativo',
  'administrator.delete': 'Eliminar en módulo administrativo',
  'administrator.export': 'Exportar módulo administrativo',
  'administrator.configure': 'Configurar módulo administrativo',
  'academic_structure.view': 'Ver estructura académica',
  'academic_structure.create': 'Crear estructura académica',
  'academic_structure.edit': 'Editar estructura académica',
  'academic_structure.delete': 'Eliminar estructura académica',
  'academic_structure.export': 'Exportar estructura académica',
  'academic_structure.configure': 'Configurar estructura académica',
  'periods.view': 'Ver períodos',
  'periods.create': 'Crear períodos',
  'periods.edit': 'Editar períodos',
  'periods.delete': 'Eliminar períodos',
  'periods.export': 'Exportar períodos',
  'periods.configure': 'Configurar períodos',
  'attendance.view': 'Ver asistencias',
  'attendance.create': 'Crear asistencias',
  'attendance.edit': 'Editar asistencias',
  'attendance.delete': 'Eliminar asistencias',
  'attendance.export': 'Exportar asistencias',
  'attendance.configure': 'Configurar asistencias',
  'students.view': 'Ver estudiantes',
  'students.create': 'Crear estudiantes',
  'students.edit': 'Editar estudiantes',
  'students.delete': 'Eliminar estudiantes',
  'students.export': 'Exportar estudiantes',
  'students.configure': 'Configurar estudiantes',
  'disciplinary.view': 'Ver amonestaciones',
  'disciplinary.create': 'Crear amonestaciones',
  'disciplinary.edit': 'Editar amonestaciones',
  'disciplinary.delete': 'Eliminar amonestaciones',
  'disciplinary.export': 'Exportar amonestaciones',
  'disciplinary.configure': 'Configurar amonestaciones',
  'communications.view': 'Ver avisos',
  'communications.create': 'Crear avisos',
  'communications.edit': 'Editar avisos',
  'communications.delete': 'Eliminar avisos',
  'communications.export': 'Exportar avisos',
  'communications.configure': 'Configurar avisos',
  'appeals.view': 'Ver apelaciones',
  'appeals.create': 'Crear apelaciones',
  'appeals.edit': 'Editar apelaciones',
  'appeals.delete': 'Eliminar apelaciones',
  'appeals.export': 'Exportar apelaciones',
  'appeals.configure': 'Configurar apelaciones',
  'roles_permissions.view': 'Ver roles y permisos',
  'roles_permissions.create': 'Crear roles y permisos',
  'roles_permissions.edit': 'Editar roles y permisos',
  'roles_permissions.delete': 'Eliminar roles y permisos',
  'roles_permissions.export': 'Exportar roles y permisos',
  'roles_permissions.configure': 'Configurar roles y permisos',
  'specialties.view': 'Ver especialidades',
  'specialties.create': 'Crear especialidades',
  'specialties.edit': 'Editar especialidades',
  'specialties.delete': 'Eliminar especialidades',
  'specialties.export': 'Exportar especialidades',
  'specialties.configure': 'Configurar especialidades',
  'sections.view': 'Ver secciones',
  'sections.create': 'Crear secciones',
  'sections.edit': 'Editar secciones',
  'sections.delete': 'Eliminar secciones',
  'sections.export': 'Exportar secciones',
  'sections.configure': 'Configurar secciones',
};

const ROLE_DESCRIPTIONS = {
  Administrador: 'Acceso completo al módulo administrativo',
  Docente: 'Personal docente. Puede asignarse como docente guía de una sección.',
};

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '12345',
  database: process.env.DB_DATABASE ?? 'EduSmart',
  charset: 'utf8mb4',
});

let repairedPermissions = 0;
for (const [code, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
  const [result] = await conn.query(
    'UPDATE permissions SET description = ? WHERE code = ? AND description <> ?',
    [description, code, description],
  );
  repairedPermissions += result.affectedRows ?? 0;
}

let repairedRoles = 0;
for (const [name, description] of Object.entries(ROLE_DESCRIPTIONS)) {
  const [result] = await conn.query(
    'UPDATE roles SET description = ? WHERE name = ? AND description <> ?',
    [description, name, description],
  );
  repairedRoles += result.affectedRows ?? 0;
}

const [removedSpecialties] = await conn.query(
  "DELETE FROM specialties WHERE name LIKE '%├%' OR description LIKE '%├%'",
);

const [specialties] = await conn.query('SELECT id_specialties, name, description FROM specialties');
console.log({
  repairedPermissions,
  repairedRoles,
  removedSpecialties: removedSpecialties.affectedRows,
  specialties,
});

await conn.end();
