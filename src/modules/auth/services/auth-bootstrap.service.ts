import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from '../repositories/auth.repository';

const DEFAULT_ADMIN_EMAIL = 'admin@ctphojancha.ed.cr';
const DEFAULT_ADMIN_PASSWORD = 'Admin1234';
const DEFAULT_ADMIN_NAME = 'Administrador';

@Injectable()
export class AuthBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AuthBootstrapService.name);

  constructor(private readonly authRepository: AuthRepository) {}

  async onModuleInit(): Promise<void> {
    const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
    const existing = await this.authRepository.findByEmail(email);
    if (existing) return;

    await this.authRepository.createUser({
      email,
      name: DEFAULT_ADMIN_NAME,
      passwordHash: await bcrypt.hash(password, 10),
    });
    this.logger.log(`Admin user seeded: ${email}`);
  }
}
