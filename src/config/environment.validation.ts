import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV?: NodeEnv = NodeEnv.Development;

  @IsNumber()
  @IsOptional()
  PORT?: number = 3000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string = '*';

  @IsString()
  DB_HOST!: string;

  @IsNumber()
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_DATABASE!: string;

  @IsString()
  @MinLength(8)
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRATION!: string;

  @IsString()
  @MinLength(8)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRATION!: string;

  @IsString()
  @IsOptional()
  MAIL_HOST?: string;

  @IsNumber()
  @IsOptional()
  MAIL_PORT?: number;

  @IsString()
  @IsOptional()
  MAIL_USER?: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM_NAME?: string;

  @IsOptional()
  MAIL_SECURE?: string | boolean;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (validated.NODE_ENV === NodeEnv.Production) {
    const problems = productionConfigProblems(config);
    if (problems.length > 0) {
      throw new Error(
        `Configuración insegura para producción. Corrija el archivo .env:\n- ${problems.join('\n- ')}`,
      );
    }
  }

  return validated;
}

/** Contraseña con la que se siembra el administrador en desarrollo. Nunca en producción. */
export const DEV_ADMIN_PASSWORD = 'Admin1234';
export const MIN_PRODUCTION_SECRET_LENGTH = 32;
export const MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH = 12;

/** Valores de ejemplo o triviales que no pueden firmar sesiones reales. */
const EXAMPLE_SECRETS = [
  /changeme/i,
  /^secret$/i,
  /^password$/i,
  /^12345/,
  /^jwt[_-]?(refresh[_-]?)?secret$/i,
];

/**
 * Problemas de configuración que harían inseguro un despliegue. Solo se exige con
 * NODE_ENV=production: en desarrollo los valores de ejemplo siguen funcionando.
 */
export function productionConfigProblems(config: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = String(config[name] ?? '');
    if (EXAMPLE_SECRETS.some((pattern) => pattern.test(value))) {
      problems.push(
        `${name} usa un valor de ejemplo. Genere uno aleatorio (p. ej. openssl rand -hex 32).`,
      );
    } else if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
      problems.push(`${name} debe tener al menos ${MIN_PRODUCTION_SECRET_LENGTH} caracteres.`);
    }
  }
  if (config.JWT_SECRET && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos.');
  }
  const corsOrigin = String(config.CORS_ORIGIN ?? '').trim();
  if (!corsOrigin || corsOrigin.split(',').some((origin) => origin.trim() === '*')) {
    problems.push(
      'CORS_ORIGIN debe indicar el dominio del frontend (p. ej. https://edusmart.vercel.app); no se permite "*".',
    );
  }
  const adminPassword = String(config.ADMIN_PASSWORD ?? '');
  if (adminPassword) {
    const problem = adminPasswordProblem(adminPassword);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** Contraseña del administrador inicial aceptable en producción, o el motivo por el que no lo es. */
export function adminPasswordProblem(password: string): string | null {
  if (password === DEV_ADMIN_PASSWORD) {
    return 'ADMIN_PASSWORD no puede ser la contraseña de ejemplo (Admin1234).';
  }
  if (password.length < MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH) {
    return `ADMIN_PASSWORD debe tener al menos ${MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}
