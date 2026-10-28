import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CommunicationTargetDto } from '../dto/communication-target.dto';
import { CommunicationsRepository } from '../repositories/communications.repository';
import { RecipientType } from '../entities/communication-recipient.entity';

@Injectable()
export class CommunicationTargetingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly repository: CommunicationsRepository,
  ) {}

  async getUserTargetContext(
    userId: number,
    roles: string[],
  ): Promise<{ roleNames: string[]; groupIds: number[] }> {
    const roleNamesSet = new Set<string>();

    for (const r of roles) {
      roleNamesSet.add(r);
      const lower = r.toLowerCase();
      if (lower.includes('admin')) {
        roleNamesSet.add('Administrador');
        roleNamesSet.add('ADMIN');
      }
      if (lower.includes('docente') || lower.includes('teacher')) {
        roleNamesSet.add('Docente');
        roleNamesSet.add('TEACHER');
      }
      if (lower.includes('estudiante') || lower.includes('student')) {
        roleNamesSet.add('Estudiante');
        roleNamesSet.add('STUDENT');
      }
      if (lower.includes('encargado') || lower.includes('guardian') || lower.includes('padre')) {
        roleNamesSet.add('Encargado');
        roleNamesSet.add('Padre de familia');
        roleNamesSet.add('GUARDIAN');
      }
      if (lower.includes('director')) {
        roleNamesSet.add('Director');
      }
      if (lower.includes('orientador')) {
        roleNamesSet.add('Orientador');
      }
    }

    const groupIdsSet = new Set<number>();

    // 1. Grupos como estudiante
    try {
      const studentGroups: { id_groups: number }[] = await this.dataSource.query(
        'SELECT id_groups FROM group_enrollments WHERE id_users = ?',
        [userId],
      );
      for (const g of studentGroups) {
        if (g.id_groups) groupIdsSet.add(Number(g.id_groups));
      }
    } catch {
      // Ignorar si la tabla no tuviese registros
    }

    // 2. Grupos como docente
    try {
      const teacherGroups: { id_groups: number }[] = await this.dataSource.query(
        'SELECT id_groups FROM teaching_assignments WHERE id_users = ?',
        [userId],
      );
      for (const g of teacherGroups) {
        if (g.id_groups) groupIdsSet.add(Number(g.id_groups));
      }
    } catch {
      // Ignorar si no aplica
    }

    // 3. Grupos como encargado
    try {
      const guardianGroups: { id_groups: number }[] = await this.dataSource.query(
        `SELECT ge.id_groups
         FROM guardian_student_links gsl
         INNER JOIN group_enrollments ge ON ge.id_users = gsl.id_users_student
         WHERE gsl.id_users_guardian = ?`,
        [userId],
      );
      for (const g of guardianGroups) {
        if (g.id_groups) groupIdsSet.add(Number(g.id_groups));
      }
    } catch {
      // Ignorar si no aplica
    }

    return {
      roleNames: Array.from(roleNamesSet),
      groupIds: Array.from(groupIdsSet),
    };
  }

  async setTargets(
    communicationId: string,
    targets: CommunicationTargetDto[],
  ): Promise<void> {
    await this.repository.replaceRecipients(communicationId, targets);
  }

  async getTargetOptions(): Promise<{
    roles: { value: string; label: string }[];
    groups: { id: string; name: string }[];
  }> {
    const roleLabels: Record<string, string> = {
      Administrador: 'Administración',
      Director: 'Dirección',
      Orientador: 'Orientación',
      Docente: 'Docentes',
      Estudiante: 'Estudiantes',
      Encargado: 'Padres y encargados',
    };
    let roles: { value: string; label: string }[] = [];
    try {
      const dbRoles: { name: string }[] = await this.dataSource.query(
        'SELECT name FROM roles ORDER BY id_roles ASC',
      );
      roles = dbRoles.map((r) => ({ value: r.name, label: roleLabels[r.name] ?? r.name }));
    } catch {
      roles = [];
    }
    if (roles.length === 0) {
      roles = ['Docente', 'Estudiante', 'Encargado'].map((name) => ({
        value: name,
        label: roleLabels[name],
      }));
    }

    let groups: { id: string; name: string }[] = [];
    try {
      const dbGroups: { id: number; name: string; section_name: string }[] = await this.dataSource.query(
        `SELECT g.id_groups AS id, g.name, s.name AS section_name
         FROM \`groups\` g
         INNER JOIN sections s ON s.id_sections = g.id_sections
         WHERE g.status = 'ACTIVE'
         ORDER BY s.grade_level ASC, s.name ASC, g.name ASC`,
      );
      groups = dbGroups.map((g) => ({
        id: String(g.id),
        name: g.name === g.section_name ? g.name : `${g.name} · ${g.section_name}`,
      }));
    } catch {
      groups = [];
    }

    return { roles, groups };
  }
}
