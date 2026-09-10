import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private transporterKey: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    const host = (this.configService.get<string>('mail.host') ?? '').trim();
    const user = this.configService.get<string>('mail.user') ?? '';
    const password = this.configService.get<string>('mail.password') ?? '';
    const fromAddress =
      this.configService.get<string>('mail.from') ?? 'no-reply@edusmart.local';
    const fromName =
      this.configService.get<string>('mail.fromName') ?? 'EduSmart CTP Hojancha';
    const port = this.configService.get<number>('mail.port') ?? 587;
    const nodeEnv = this.configService.get<string>('app.nodeEnv') ?? 'development';

    const smtpConfigured =
      Boolean(host) &&
      host !== 'smtp.example.com' &&
      Boolean(user) &&
      Boolean(password);

    if (!smtpConfigured) {
      this.logger.warn(
        `Mail stub (SMTP not configured) -> to=${options.to} subject=${options.subject}`,
      );
      if (nodeEnv !== 'production') {
        this.logger.warn(
          'Configure MAIL_HOST/MAIL_USER/MAIL_PASSWORD (Brevo SMTP) for real delivery.',
        );
      }
      return;
    }

    const transporter = this.getTransporter(host, port, user, password);
    const from = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(
        `Mail sent to=${options.to} subject=${options.subject} id=${info.messageId ?? 'n/a'}`,
      );
    } catch (error) {
      this.logger.error(
        `Mail failed to=${options.to} subject=${options.subject}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private getTransporter(
    host: string,
    port: number,
    user: string,
    password: string,
  ): Transporter {
    const key = `${host}:${port}:${user}`;
    if (!this.transporter || this.transporterKey !== key) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587 || port === 2525,
        auth: { user, pass: password },
      });
      this.transporterKey = key;
    }
    return this.transporter;
  }
}
