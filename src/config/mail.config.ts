import { registerAs } from '@nestjs/config';

function parseMailSecure(port: number): boolean {
  const raw = (process.env.MAIL_SECURE ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return port === 465;
}

export default registerAs('mail', () => {
  const port = parseInt(process.env.MAIL_PORT ?? '587', 10);
  return {
    host: process.env.MAIL_HOST ?? 'smtp.example.com',
    port,
    secure: parseMailSecure(port),
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'no-reply@edusmart.local',
    fromName: process.env.MAIL_FROM_NAME ?? 'EduSmart CTP Hojancha',
  };
});
