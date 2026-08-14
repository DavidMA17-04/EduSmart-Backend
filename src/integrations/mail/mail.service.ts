import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    // Stub: no real SMTP I/O until credentials/requirements are defined.
    this.logger.debug(
      `Mail stub -> to=${options.to} subject=${options.subject} host=${this.configService.get('mail.host')}`,
    );
  }
}
