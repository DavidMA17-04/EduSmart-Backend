import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class UsersBootstrapService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    // Datos automáticos desactivados
  }
}

