import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

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
    const from = this.configService.get<string>('mail.from') ?? 'no-reply@edusmart.local';
    const port = this.configService.get<number>('mail.port') ?? 587;
    const nodeEnv = this.configService.get<string>('app.nodeEnv') ?? 'development';

    const smtpConfigured =
      Boolean(host) &&
      host !== 'smtp.example.com' &&
      Boolean(user) &&
      Boolean(password);

    if (!smtpConfigured) {
      this.logger.debug(
        `Mail stub (SMTP not configured) -> to=${options.to} subject=${options.subject}`,
      );
      if (nodeEnv !== 'production') {
        this.logger.debug(
          'Configure MAIL_HOST/MAIL_USER/MAIL_PASSWORD for real delivery. Verification codes are never logged.',
        );
      }
      return;
    }

    const transporter = this.getTransporter(host, port, user, password);
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  private getTransporter(
    host: string,
    port: number,
    user: string,
    password: string,
  ): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
      });
    }
    return this.transporter;
  }
}
