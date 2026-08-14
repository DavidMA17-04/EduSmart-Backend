import { Injectable, NotImplementedException } from '@nestjs/common';
import { BulkImportDto } from '../dto/bulk-import.dto';

@Injectable()
export class BulkImportService {
  importData(_dto: BulkImportDto) {
    throw new NotImplementedException('Carga masiva pendiente de implementar');
  }
}
