import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { MailCidAttachment } from './optional-logo.attachment';

/** Thrown when MAIL_* is incomplete — callers must treat as send failure, never as success. */
export class SmtpNotConfiguredError extends Error {
  readonly code = 'SMTP_NOT_CONFIGURED';

  constructor(message = 'SMTP is not configured (MAIL_HOST/MAIL_USER/MAIL_PASSWORD)') {
    super(message);
    this.name = 'SmtpNotConfiguredError';
  }
}

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
    /** Optional CID/file attachments. Failures with attachments retry once without them. */
    attachments?: MailCidAttachment[];
  }): Promise<void> {
    const host = (this.configService.get<string>('mail.host') ?? '').trim();
    const user = this.configService.get<string>('mail.user') ?? '';
    const password = this.configService.get<string>('mail.password') ?? '';
    const fromAddress =
      this.configService.get<string>('mail.from') ?? 'no-reply@edusmart.local';
    const fromName =
      this.configService.get<string>('mail.fromName') ?? 'EduSmart CTP Hojancha';
    const port = Number(this.configService.get<number | string>('mail.port') ?? 587);
    const secure = this.resolveSecure(port);

    const smtpConfigured =
      Boolean(host) &&
      host !== 'smtp.example.com' &&
      Boolean(user) &&
      Boolean(password);

    if (!smtpConfigured) {
      this.logger.error(
        `SMTP_NOT_CONFIGURED to=${options.to} subject=${options.subject} host=${host || '(empty)'} port=${port}`,
      );
      throw new SmtpNotConfiguredError();
    }

    const transporter = this.getTransporter(host, port, secure, user, password);
    const from = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
    const attachments = this.toNodemailerAttachments(options.attachments);

    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        ...(attachments ? { attachments } : {}),
      });
      this.logger.log(
        `Mail sent to=${options.to} subject=${options.subject} id=${info.messageId ?? 'n/a'}`,
      );
    } catch (error) {
      if (attachments && attachments.length > 0) {
        this.logger.warn(
          `Mail attachment failed for to=${options.to} subject=${options.subject}; retrying without attachments`,
        );
        try {
          const info = await transporter.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
          });
          this.logger.log(
            `Mail sent to=${options.to} subject=${options.subject} id=${info.messageId ?? 'n/a'} (without attachments)`,
          );
          return;
        } catch (retryError) {
          this.logger.error(
            `Mail failed to=${options.to} subject=${options.subject} host=${host} port=${port}: ${
              retryError instanceof Error ? retryError.message : String(retryError)
            }`,
          );
          throw retryError;
        }
      }

      this.logger.error(
        `Mail failed to=${options.to} subject=${options.subject} host=${host} port=${port}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private toNodemailerAttachments(
    attachments: MailCidAttachment[] | undefined,
  ):
    | Array<{
        filename: string;
        content: Buffer;
        cid: string;
        contentType: string;
        contentDisposition: 'inline';
      }>
    | undefined {
    if (!attachments?.length) {
      return undefined;
    }
    try {
      return attachments.map((item) => ({
        filename: item.filename,
        content: item.content,
        cid: item.cid,
        contentType: item.contentType,
        contentDisposition: 'inline' as const,
      }));
    } catch {
      return undefined;
    }
  }

  private resolveSecure(port: number): boolean {
    const configured = this.configService.get<boolean | string>('mail.secure');
    if (typeof configured === 'boolean') return configured;
    if (typeof configured === 'string') {
      const raw = configured.trim().toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes') return true;
      if (raw === 'false' || raw === '0' || raw === 'no') return false;
    }
    return port === 465;
  }

  private getTransporter(
    host: string,
    port: number,
    secure: boolean,
    user: string,
    password: string,
  ): Transporter {
    const key = `${host}:${port}:${secure}:${user}`;
    if (this.transporter && this.transporterKey === key) {
      return this.transporter;
    }

    const options: SMTPTransport.Options = {
      host,
      port,
      secure,
      requireTLS: !secure && (port === 587 || port === 2525),
      auth: { user, pass: password },
      connectionTimeout: 60_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
      tls: {
        minVersion: 'TLSv1.2',
        servername: host,
      },
    };
    this.transporter = nodemailer.createTransport(options);
    this.transporterKey = key;
    return this.transporter;
  }
}
