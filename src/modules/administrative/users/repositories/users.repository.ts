import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { INSTITUTIONAL_ROLE_TEACHER } from '../../../../common/constants/institutional-roles.constant';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { UserRoleEntity } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';

const USER_RELATIONS = {
  userRoles: { role: true },
} as const;

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
  ) {}

  create(data: Partial<User>): User {
    return this.repository.create(data);
  }

  async save(entity: User): Promise<User> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      relations: USER_RELATIONS,
      order: { name: 'ASC' },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.repository
      .createQueryBuilder('user')
      .select('user.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.status')
      .getRawMany<{ status: string; count: string }>();

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  async countByRole(): Promise<Record<number, number>> {
    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .select('ur.roleId', 'roleId')
      .addSelect('COUNT(DISTINCT ur.userId)', 'count')
      .groupBy('ur.roleId')
      .getRawMany<{ roleId: string; count: string }>();

    const counts: Record<number, number> = {};
    for (const row of rows) {
      counts[Number(row.roleId)] = Number(row.count);
    }
    return counts;
  }

  async findPage(options: {
    page: number;
    limit: number;
    status?: UserStatus;
    roleId?: number;
    search?: string;
  }): Promise<{ items: User[]; total: number }> {
    const applyFilters = (qb: ReturnType<Repository<User>['createQueryBuilder']>) => {
      if (options.status) {
        qb.andWhere('user.status = :status', { status: options.status });
      }

      if (options.roleId) {
        qb.andWhere(
          `EXISTS (
            SELECT 1 FROM user_roles ur_filter
            WHERE ur_filter.id_users = user.id_users
              AND ur_filter.id_roles = :roleId
          )`,
          { roleId: options.roleId },
        );
      }

      if (options.search) {
        const term = `%${options.search.toLowerCase()}%`;
        qb.andWhere(
          `(
            LOWER(user.national_id) LIKE :term
            OR LOWER(user.name) LIKE :term
            OR LOWER(user.first_lastname) LIKE :term
            OR LOWER(COALESCE(user.second_lastname, '')) LIKE :term
            OR LOWER(user.email) LIKE :term
          )`,
          { term },
        );
      }
      return qb;
    };

    const countQb = applyFilters(this.repository.createQueryBuilder('user'));
    const total = await countQb.getCount();

    const itemsQb = applyFilters(
      this.repository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.userRoles', 'userRoles')
        .leftJoinAndSelect('userRoles.role', 'role')
        .orderBy('user.name', 'ASC'),
    );

    const items = await itemsQb
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getMany();

    return { items, total };
  }

  async findGuideTeachers(): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.userRoles', 'userRoles')
      .innerJoinAndSelect('userRoles.role', 'role')
      .where('role.name = :roleName', { roleName: INSTITUTIONAL_ROLE_TEACHER })
      .andWhere('role.status = :roleStatus', { roleStatus: RoleStatus.ACTIVE })
      .andWhere('user.status = :userStatus', { userStatus: UserStatus.ACTIVE })
      .orderBy('user.first_lastname', 'ASC')
      .addOrderBy('user.name', 'ASC')
      .getMany();
  }

  async findById(id: number): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: USER_RELATIONS,
    });
  }

  async findByNationalId(
    nationalId: string,
    excludeId?: number,
  ): Promise<User | null> {
    return this.repository.findOne({
      where: excludeId
        ? { national_id: nationalId, id: Not(excludeId) }
        : { national_id: nationalId },
    });
  }

  async findByEmail(email: string, excludeId?: number): Promise<User | null> {
    return this.repository.findOne({
      where: excludeId ? { email, id: Not(excludeId) } : { email },
    });
  }

  async replaceRoles(userId: number, roles: Array<{ id: number }>): Promise<void> {
    await this.userRoles.delete({ userId });
    if (!roles.length) return;
    await this.userRoles.save(
      roles.map((role) =>
        this.userRoles.create({ userId, roleId: role.id }),
      ),
    );
  }
}
