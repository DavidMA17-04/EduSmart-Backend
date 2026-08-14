import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST ?? 'smtp.example.com',
  port: parseInt(process.env.MAIL_PORT ?? '587', 10),
  user: process.env.MAIL_USER ?? '',
  password: process.env.MAIL_PASSWORD ?? '',
  from: process.env.MAIL_FROM ?? 'no-reply@edusmart.local',
}));
