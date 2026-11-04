import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditLogEntry } from '../repositories/audit-log.repository';
import { toAuditLogView, AuditLogView } from '../mappers/audit-log.mapper';

@Injectable()
export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  record(entry: AuditLogEntry) {
    return this.repository.append(entry);
  }

  listForUser(userId: number): Promise<AuditLogView[]> {
    return this.repository
      .findByEntity('User', String(userId))
      .then((logs) => logs.map(toAuditLogView));
  }
}
