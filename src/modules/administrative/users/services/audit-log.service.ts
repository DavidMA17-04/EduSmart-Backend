import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditLogEntry } from '../repositories/audit-log.repository';

@Injectable()
export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  record(entry: AuditLogEntry) {
    return this.repository.append(entry);
  }
}
