import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateNonWorkingDayDto, UpdateDisciplinarySettingsDto } from '../dto/disciplinary-calendar.dto';
import { DisciplinarySettingsEntity } from '../entities/disciplinary-settings.entity';
import { NonWorkingDayEntity } from '../entities/non-working-day.entity';

const SETTINGS_ID = 1;
const DAY_AUDIT = 'non_working_days';
const SETTINGS_AUDIT = 'disciplinary_settings';

/**
 * Los vencimientos no se guardan: se calculan al leer con este calendario.
 * Agregar o quitar un día no hábil corre los plazos abiertos en la siguiente consulta.
 */
@Injectable()
export class DisciplinaryCalendarService {
  constructor(
    @InjectRepository(NonWorkingDayEntity)
    private readonly days: Repository<NonWorkingDayEntity>,
    @InjectRepository(DisciplinarySettingsEntity)
    private readonly settings: Repository<DisciplinarySettingsEntity>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async listDays() {
    const rows = await this.days.find({ order: { day: 'ASC' } });
    return rows.map((row) => this.toDay(row));
  }

  async createDay(actor: AuthenticatedUser, dto: CreateNonWorkingDayDto) {
    const existing = await this.days.findOne({ where: { day: dto.day } });
    if (existing) {
      throw new ConflictException({
        code: 'NON_WORKING_DAY_EXISTS',
        message: 'Ese día ya está en el calendario',
        field: 'day',
      });
    }
    const saved = await this.days.save(
      this.days.create({
        day: dto.day,
        reason: dto.reason.trim(),
        authorUserId: actor.id,
      }),
    );
    await this.audit(actor, 'NON_WORKING_DAY_CREATE', saved.id, null, {
      day: dto.day,
      reason: saved.reason,
    });
    return this.toDay(saved);
  }

  async deleteDay(actor: AuthenticatedUser, id: number) {
    const row = await this.days.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NON_WORKING_DAY_NOT_FOUND', message: 'El día no hábil no existe' });
    }
    await this.days.delete(id);
    await this.audit(actor, 'NON_WORKING_DAY_DELETE', id, { day: String(row.day).slice(0, 10), reason: row.reason }, null);
    return { id, day: String(row.day).slice(0, 10) };
  }

  async getSettings() {
    const row = await this.ensureSettings();
    return this.toSettings(row);
  }

  async updateSettings(actor: AuthenticatedUser, dto: UpdateDisciplinarySettingsDto) {
    const current = await this.ensureSettings();
    const before = this.toSettings(current);
    current.recidivismThreshold = dto.recidivismThreshold;
    current.conductAlertThreshold = dto.conductAlertThreshold;
    const saved = await this.settings.save(current);
    const after = this.toSettings(saved);
    await this.audit(actor, 'DISCIPLINARY_SETTINGS_UPDATE', SETTINGS_ID, before, after);
    return after;
  }

  private async ensureSettings(): Promise<DisciplinarySettingsEntity> {
    const row = await this.settings.findOne({ where: { id: SETTINGS_ID } });
    if (row) return row;
    return this.settings.save(
      this.settings.create({ id: SETTINGS_ID, recidivismThreshold: 3, conductAlertThreshold: 80 }),
    );
  }

  private toDay(row: NonWorkingDayEntity) {
    return {
      id: row.id,
      day: String(row.day).slice(0, 10),
      reason: row.reason,
      authorUserId: row.authorUserId,
    };
  }

  private toSettings(row: DisciplinarySettingsEntity) {
    return {
      recidivismThreshold: row.recidivismThreshold,
      conductAlertThreshold: row.conductAlertThreshold,
    };
  }

  private audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: number,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) {
    const entity = action.startsWith('NON_WORKING') ? DAY_AUDIT : SETTINGS_AUDIT;
    return this.auditLogs.save(
      this.auditLogs.create({
        actorId: actor.id,
        action,
        entity,
        entityId: String(entityId),
        before,
        after,
      }),
    );
  }
}
