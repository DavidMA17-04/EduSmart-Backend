import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthRepository {
  // Data access stub — wire TypeORM user lookups in a later phase.
  async findByEmail(
    _email: string,
  ): Promise<{ id: string; email: string; passwordHash: string } | null> {
    return null;
  }

  async findById(_id: string): Promise<{ id: string; email: string } | null> {
    return null;
  }
}
