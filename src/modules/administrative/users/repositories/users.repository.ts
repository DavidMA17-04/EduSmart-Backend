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

  async findGuideTeachers(): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.userRoles', 'userRoles')
      .innerJoinAndSelect('userRoles.role', 'role')
      .where('role.name = :roleName', { roleName: INSTITUTIONAL_ROLE_TEACHER })
      .andWhere('role.status = :roleStatus', { roleStatus: RoleStatus.ACTIVE })
      .andWhere('user.status = :userStatus', { userStatus: UserStatus.ACTIVE })
      .orderBy('user.lastName', 'ASC')
      .addOrderBy('user.firstName', 'ASC')
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
