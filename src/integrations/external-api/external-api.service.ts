import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);

  async request<T = unknown>(_path: string): Promise<T | null> {
    // Stub for future external HTTP integrations.
    this.logger.debug('External API stub request called');
    return null;
  }
}
