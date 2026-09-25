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

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'token',
  'secret',
  'secrets',
]);

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return sanitizeAuditRecord(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeAuditRecord(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_AUDIT_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = sanitizeAuditValue(value);
  }

  return sanitized;
}

function sanitizeAuditPayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload ?? null;
  }

  return sanitizeAuditRecord(payload);
}

export function toAuditLogView(log: AuditLog): AuditLogView {
  return {
    id: log.id,
    actorId: log.actorId ?? null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    before: sanitizeAuditPayload(log.before),
    after: sanitizeAuditPayload(log.after),
    createdAt: log.createdAt,
  };
}
