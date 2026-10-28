const mysql = require('mysql2/promise');
const crypto = require('crypto');

async function seed() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'changeme',
    database: 'edusmart',
  });

  const comm1 = crypto.randomUUID();
  const comm2 = crypto.randomUUID();
  const comm3 = crypto.randomUUID();

  await conn.execute(
    `INSERT INTO communications (id, title, content, priority, status, requires_acknowledgment, publish_date, author_id)
     VALUES (?, ?, ?, 'URGENT', 'PUBLISHED', 1, NOW(), 1)`,
    [
      comm1,
      'Convocatoria oficial: Entrega de notas y asamblea general',
      'Se convoca a toda la comunidad educativa del CTP de Hojancha a la primera entrega de notas del curso lectivo. Es indispensable que los encargados confirmen la recepción y asistan en la fecha estipulada en el gimnasio institucional.',
    ],
  );

  await conn.execute(
    `INSERT INTO communication_recipients (id, communication_id, recipient_type) VALUES (?, ?, 'ALL')`,
    [crypto.randomUUID(), comm1],
  );

  await conn.execute(
    `INSERT INTO communications (id, title, content, priority, status, requires_acknowledgment, publish_date, author_id)
     VALUES (?, ?, ?, 'NORMAL', 'PUBLISHED', 0, NOW(), 1)`,
    [
      comm2,
      'Actualización de horarios de talleres y laboratorios',
      'Estimados docentes y estudiantes: A partir de la próxima semana se habilitará el uso extendido de los talleres de electromecánica y laboratorios de informática. Favor revisar la distribución en el panel institucional.',
    ],
  );

  await conn.execute(
    `INSERT INTO communication_recipients (id, communication_id, recipient_type) VALUES (?, ?, 'ALL')`,
    [crypto.randomUUID(), comm2],
  );

  await conn.execute(
    `INSERT INTO communications (id, title, content, priority, status, requires_acknowledgment, author_id)
     VALUES (?, ?, ?, 'NORMAL', 'DRAFT', 0, 1)`,
    [
      comm3,
      'Borrador: Concurso de innovación y robótica CTP Hojancha',
      'Borrador preliminar con los lineamientos y categorías para la feria científica y de innovación tecnológica 2026.',
    ],
  );

  await conn.execute(
    `INSERT INTO communication_recipients (id, communication_id, recipient_type) VALUES (?, ?, 'ALL')`,
    [crypto.randomUUID(), comm3],
  );

  console.log('Successfully seeded 3 sample communications!');
  await conn.end();
}

seed().catch(console.error);
