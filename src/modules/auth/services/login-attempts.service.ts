import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Intentos fallidos permitidos por cédula antes de bloquearla temporalmente. */
export const DEFAULT_MAX_FAILURES_PER_IDENTIFIER = 5;
/**
 * Intentos fallidos permitidos por IP. Es alto a propósito: en una presentación
 * o en el colegio, muchas personas comparten la misma IP pública (mismo Wi-Fi).
 */
export const DEFAULT_MAX_FAILURES_PER_IP = 60;
export const DEFAULT_LOCK_MINUTES = 15;

interface Bucket {
  failures: number[];
}

/**
 * Límite de intentos fallidos de inicio de sesión, en memoria (una sola
 * instancia del backend). Cuenta solo los fallos dentro de la ventana; un
 * ingreso correcto limpia el contador de esa cédula.
 *
 * Activo siempre en producción. En desarrollo solo con LOGIN_RATE_LIMIT=true,
 * para no interferir con las pruebas automáticas.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxPerIdentifier = positiveInt(
    process.env.LOGIN_MAX_ATTEMPTS,
    DEFAULT_MAX_FAILURES_PER_IDENTIFIER,
  );
  private readonly maxPerIp = positiveInt(process.env.LOGIN_MAX_ATTEMPTS_PER_IP, DEFAULT_MAX_FAILURES_PER_IP);
  private readonly windowMs =
    positiveInt(process.env.LOGIN_LOCK_MINUTES, DEFAULT_LOCK_MINUTES) * 60_000;

  /** Reloj inyectable en pruebas. */
  now: () => number = () => Date.now();

  get enabled(): boolean {
    const flag = String(process.env.LOGIN_RATE_LIMIT ?? '').trim().toLowerCase();
    if (flag === 'false') return false;
    return process.env.NODE_ENV === 'production' || flag === 'true';
  }

  /** Lanza 429 si la cédula o la IP superaron el límite de intentos fallidos. */
  assertAllowed(identifier: string, ip: string | null | undefined): void {
    if (!this.enabled) return;
    const waits = [
      this.retryAfterMs(`id:${identifier}`, this.maxPerIdentifier),
      ip ? this.retryAfterMs(`ip:${ip}`, this.maxPerIp) : 0,
    ];
    const wait = Math.max(...waits);
    if (wait <= 0) return;
    const minutes = Math.max(1, Math.ceil(wait / 60_000));
    throw new HttpException(
      {
        message: `Demasiados intentos fallidos. Espere ${minutes} ${
          minutes === 1 ? 'minuto' : 'minutos'
        } e intente de nuevo.`,
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  registerFailure(identifier: string, ip: string | null | undefined): void {
    if (!this.enabled) return;
    this.push(`id:${identifier}`);
    if (ip) this.push(`ip:${ip}`);
    this.prune();
  }

  registerSuccess(identifier: string): void {
    this.buckets.delete(`id:${identifier}`);
  }

  private push(key: string): void {
    const bucket = this.buckets.get(key) ?? { failures: [] };
    bucket.failures.push(this.now());
    this.buckets.set(key, bucket);
  }

  /** Milisegundos hasta que se libere un intento, o 0 si no está bloqueado. */
  private retryAfterMs(key: string, max: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    const since = this.now() - this.windowMs;
    bucket.failures = bucket.failures.filter((at) => at > since);
    if (bucket.failures.length < max) return 0;
    const oldestRelevant = bucket.failures[bucket.failures.length - max];
    return oldestRelevant + this.windowMs - this.now();
  }

  /** Evita que el mapa crezca sin límite con cédulas o IPs que ya no intentan. */
  private prune(): void {
    if (this.buckets.size < 5_000) return;
    const since = this.now() - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      if (!bucket.failures.some((at) => at > since)) this.buckets.delete(key);
    }
  }
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
