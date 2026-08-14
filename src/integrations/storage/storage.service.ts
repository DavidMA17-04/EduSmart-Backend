import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async upload(_fileName: string, _content: Buffer): Promise<string> {
    // Stub: no real storage provider wired yet.
    this.logger.debug('Storage stub upload called');
    return 'stub://not-implemented';
  }

  async delete(_path: string): Promise<void> {
    this.logger.debug('Storage stub delete called');
  }
}
