import { Module } from '@nestjs/common';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { ExternalApiModule } from './external-api/external-api.module';

@Module({
  imports: [MailModule, StorageModule, ExternalApiModule],
  exports: [MailModule, StorageModule, ExternalApiModule],
})
export class IntegrationsModule {}
