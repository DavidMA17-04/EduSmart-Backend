import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  username: process.env.DB_USERNAME ?? 'sa',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'EduSmart',
}));
