import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AttendanceCalendarExceptionType } from '../../../common/enums/attendance-calendar-exception-type.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AcademicPeriod } from '../../administrative/academic-periods/entities/academic-period.entity';
import { SectionEntity } from '../../administrative/sections/entities/section.entity';
import { CreateAttendanceCalendarExceptionDto } from '../dto/create-attendance-calendar-exception.dto';
import { ListAttendanceCalendarExceptionsQueryDto } from '../dto/list-attendance-calendar-exceptions-query.dto';
import { UpdateAttendanceCalendarExceptionDto } from '../dto/update-attendance-calendar-exception.dto';
import { AttendanceCalendarException } from '../entities/attendance-calendar-exception.entity';

export type AttendanceCalendarExceptionView = {
  id: number;
  academicPeriodId: number;
  sectionId: number | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  exceptionType: AttendanceCalendarExceptionType;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AttendanceCalendarExceptionsService {
  constructor(
    @InjectRepository(AttendanceCalendarException)
    private readonly exceptions: Repository<AttendanceCalendarException>,
    @InjectRepository(AcademicPeriod)
    private readonly periods: Repository<AcademicPeriod>,
    @InjectRepository(SectionEntity)
    private readonly sections: Repository<SectionEntity>,
  ) {}

  async create(
    dto: CreateAttendanceCalendarExceptionDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceCalendarExceptionView> {
    const period = await this.requirePeriod(dto.academicPeriodId);
    await this.assertSectionBelongsToPeriod(dto.sectionId ?? null, period.id);
    this.assertValidRange(dto.startDate, dto.endDate, period);

    const saved = await this.exceptions.save(
      this.exceptions.create({
        academicPeriodId: period.id,
        sectionId: dto.sectionId ?? null,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startDate: dto.startDate.slice(0, 10),
        endDate: dto.endDate.slice(0, 10),
        exceptionType: dto.exceptionType,
        createdByUserId: actor.id,
      }),
    );

    return this.toView(saved);
  }

  async list(
    query: ListAttendanceCalendarExceptionsQueryDto,
  ): Promise<AttendanceCalendarExceptionView[]> {
    const qb = this.exceptions
      .createQueryBuilder('exc')
      .orderBy('exc.start_date', 'ASC')
      .addOrderBy('exc.id_attendance_calendar_exceptions', 'ASC');

    if (query.academicPeriodId != null) {
      qb.andWhere('exc.id_academic_periods = :periodId', {
        periodId: query.academicPeriodId,
      });
    }
    if (query.sectionId != null) {
      qb.andWhere(
        '(exc.id_sections IS NULL OR exc.id_sections = :sectionId)',
        { sectionId: query.sectionId },
      );
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toView(row));
  }

  async findOne(id: number): Promise<AttendanceCalendarExceptionView> {
    const row = await this.exceptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`AttendanceCalendarException ${id} not found`);
    }
    return this.toView(row);
  }

  async update(
    id: number,
    dto: UpdateAttendanceCalendarExceptionDto,
  ): Promise<AttendanceCalendarExceptionView> {
    const row = await this.exceptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`AttendanceCalendarException ${id} not found`);
    }

    const period = await this.requirePeriod(row.academicPeriodId);
    const nextSectionId =
      dto.sectionId !== undefined ? dto.sectionId : (row.sectionId ?? null);
    await this.assertSectionBelongsToPeriod(nextSectionId, period.id);

    const startDate = (dto.startDate ?? row.startDate).slice(0, 10);
    const endDate = (dto.endDate ?? row.endDate).slice(0, 10);
    this.assertValidRange(startDate, endDate, period);

    if (dto.sectionId !== undefined) row.sectionId = dto.sectionId;
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.startDate !== undefined) row.startDate = startDate;
    if (dto.endDate !== undefined) row.endDate = endDate;
    if (dto.exceptionType !== undefined) row.exceptionType = dto.exceptionType;

    const saved = await this.exceptions.save(row);
    return this.toView(saved);
  }

  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const row = await this.exceptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`AttendanceCalendarException ${id} not found`);
    }
    await this.exceptions.remove(row);
    return { id, deleted: true };
  }

  /**
   * Resolves the most specific active exception for a calendar date.
   * Section-scoped rows win over period-wide (sectionId null) rows.
   */
  async findActiveForDate(params: {
    date: string;
    academicPeriodId: number;
    sectionId?: number | null;
  }): Promise<AttendanceCalendarExceptionView | null> {
    const day = params.date.slice(0, 10);
    const candidates = await this.exceptions
      .createQueryBuilder('exc')
      .where('exc.id_academic_periods = :periodId', {
        periodId: params.academicPeriodId,
      })
      .andWhere('exc.start_date <= :day', { day })
      .andWhere('exc.end_date >= :day', { day })
      .andWhere(
        params.sectionId != null
          ? '(exc.id_sections IS NULL OR exc.id_sections = :sectionId)'
          : 'exc.id_sections IS NULL',
        params.sectionId != null ? { sectionId: params.sectionId } : {},
      )
      .orderBy('exc.id_sections', 'DESC')
      .addOrderBy('exc.id_attendance_calendar_exceptions', 'DESC')
      .getMany();

    if (candidates.length === 0) return null;

    const sectionScoped = candidates.find(
      (row) =>
        row.sectionId != null &&
        params.sectionId != null &&
        row.sectionId === params.sectionId,
    );
    return this.toView(sectionScoped ?? candidates[0]);
  }

  /** Convenience for unit tests / callers that still use IsNull filter style. */
  async findPeriodWide(academicPeriodId: number): Promise<AttendanceCalendarException[]> {
    return this.exceptions.find({
      where: { academicPeriodId, sectionId: IsNull() },
    });
  }

  private async requirePeriod(id: number): Promise<AcademicPeriod> {
    const period = await this.periods.findOne({ where: { id } });
    if (!period) {
      throw new NotFoundException(`AcademicPeriod ${id} not found`);
    }
    return period;
  }

  private async assertSectionBelongsToPeriod(
    sectionId: number | null,
    academicPeriodId: number,
  ): Promise<void> {
    if (sectionId == null) return;
    const section = await this.sections.findOne({ where: { id: sectionId } });
    if (!section) {
      throw new NotFoundException(`Section ${sectionId} not found`);
    }
    if (section.academicPeriodId !== academicPeriodId) {
      throw new BadRequestException({
        code: 'ATTENDANCE_EXCEPTION_SECTION_PERIOD_MISMATCH',
        message: 'sectionId does not belong to the given academic period',
      });
    }
  }

  private assertValidRange(
    startDate: string,
    endDate: string,
    period: AcademicPeriod,
  ): void {
    const start = startDate.slice(0, 10);
    const end = endDate.slice(0, 10);
    if (end < start) {
      throw new BadRequestException({
        code: 'ATTENDANCE_EXCEPTION_INVALID_RANGE',
        message: 'endDate must be on or after startDate',
      });
    }
    const periodStart = String(period.startDate).slice(0, 10);
    const periodEnd = String(period.endDate).slice(0, 10);
    if (start < periodStart || end > periodEnd) {
      throw new BadRequestException({
        code: 'ATTENDANCE_EXCEPTION_OUTSIDE_PERIOD',
        message: 'Exception dates must fall within the academic period',
        periodStart,
        periodEnd,
      });
    }
  }

  private toView(row: AttendanceCalendarException): AttendanceCalendarExceptionView {
    return {
      id: row.id,
      academicPeriodId: row.academicPeriodId,
      sectionId: row.sectionId ?? null,
      title: row.title,
      description: row.description ?? null,
      startDate: String(row.startDate).slice(0, 10),
      endDate: String(row.endDate).slice(0, 10),
      exceptionType: row.exceptionType,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
