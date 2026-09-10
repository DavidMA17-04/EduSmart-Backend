import type { Request } from 'express';

export interface RequestClientMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

export function requestClientMeta(req: Request): RequestClientMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip =
    forwardedValue?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader ?? null;
  return { userAgent, ipAddress: ip };
}
