import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogView {
  id: number;
  actorId: number | null;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

export function toAuditLogView(log: AuditLog): AuditLogView {
  return {
    id: log.id,
    actorId: log.actorId ?? null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    before: log.before ?? null,
    after: log.after ?? null,
    createdAt: log.createdAt,
  };
}
