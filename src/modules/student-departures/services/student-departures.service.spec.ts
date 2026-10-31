import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';
import { ScheduledPermitStatus } from '../entities/scheduled-departure-permit.entity';
import {
  costaRicaDateString,
  costaRicaDayBounds,
  costaRicaTodayBounds,
} from '../utils/costa-rica-time';
import { maskNationalId, normalizeNationalId } from '../utils/identity';
import {
  AUDIT_ACTION_GUARDIAN_MISMATCH,
  AUDIT_ACTION_MANUAL_REJECTION,
  DepartureValidationService,
  GUARDIAN_MISMATCH_MESSAGE,
} from './departure-validation.service';
import { StudentDeparturesService } from './student-departures.service';

const guard: AuthenticatedUser = {
  id: 50,
  email: 'guarda@ctphojancha.ed.cr',
  roles: [],
  permissions: ['departures.validate', 'departures.create'],
  mustChangePassword: false,
};
const meta = { ipAddress: '10.0.0.5', userAgent: 'jest' };

const student = {
  id: 4,
  fullName: 'Diego Rojas',
  nationalId: '300000020',
  groupId: 1,
  groupName: '10-1',
  sectionName: '10° Año',
};
const linkedGuardian = {
  id: 7,
  fullName: 'Roberto Rojas',
  nationalId: '3-0000-0030',
  nationalIdMasked: '•••••0030',
  relationship: 'Padre',
  active: true,
};

function buildMocks() {
  const saved: Array<{ entity: string; value: Record<string, unknown> }> = [];
  const permitUpdate = { affected: 1 };
  const manager = {
    getRepository: jest.fn((entity: { name: string }) => ({
      create: (value: Record<string, unknown>) => value,
      save: jest.fn(async (value: Record<string, unknown>) => {
        saved.push({ entity: entity.name, value });
        return { ...value, id: `${entity.name}-id` };
      }),
      findOne: jest.fn(),
      createQueryBuilder: () => ({
        update: () => ({ set: () => ({ where: () => ({ execute: async () => permitUpdate }) }) }),
      }),
    })),
  };
  const permitRepo = { findOne: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
    getRepository: jest.fn(() => permitRepo),
  };
  const repository = {
    findActiveStudent: jest.fn(async () => student),
    findLinkedGuardians: jest.fn(async () => [linkedGuardian]),
    findUserIdByNationalId: jest.fn(async () => null),
    findPermits: jest.fn(async () => []),
    findLastAuthorizedBetween: jest.fn(async () => null),
    expireStalePermits: jest.fn(),
    countTodayKpis: jest.fn(),
    findHistory: jest.fn(),
  };
  const validation = new DepartureValidationService(repository as never, dataSource as never);
  const service = new StudentDeparturesService(
    repository as never,
    validation,
    dataSource as never,
  );
  return { saved, repository, validation, service, permitRepo, permitUpdate };
}

describe('Costa Rica time helpers', () => {
  it('uses UTC-6 for the institutional day', () => {
    // 2026-10-31 03:00 UTC is still Oct 30 in Costa Rica.
    expect(costaRicaDateString(new Date('2026-10-31T03:00:00Z'))).toBe('2026-10-30');
    const { start, end } = costaRicaDayBounds('2026-10-30');
    expect(start.toISOString()).toBe('2026-10-30T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T06:00:00.000Z');
  });

  it('masks and normalizes national ids', () => {
    expect(normalizeNationalId('3-0000-0030')).toBe('300000030');
    expect(maskNationalId('300000030')).toBe('•••••0030');
  });
});

describe('DepartureValidationService', () => {
  it('authorizes when the presented ID matches an active linked guardian (ignoring dashes)', async () => {
    const { validation, saved } = buildMocks();
    const result = await validation.validateGuardian('300000020', '300000030', guard, meta);
    expect(result.authorized).toBe(true);
    expect(result.relationship).toBe('Padre');
    expect(result.registeredGuardians[0]).not.toHaveProperty('nationalId');
    expect(saved).toHaveLength(0);
  });

  it('rejects a mismatch and writes both the rejected attempt and the audit alert', async () => {
    const { validation, saved } = buildMocks();
    const result = await validation.validateGuardian('300000020', '999999999', guard, meta);
    expect(result.authorized).toBe(false);
    expect(result.message).toBe(GUARDIAN_MISMATCH_MESSAGE);
    expect(result.rejectionId).toBe('StudentDeparture-id');
    const departure = saved.find((s) => s.entity === 'StudentDeparture')!.value;
    expect(departure.status).toBe(DepartureStatus.REJECTED);
    expect(departure.securityGuardId).toBe(guard.id);
    const audit = saved.find((s) => s.entity === 'AuditLog')!.value;
    expect(audit.action).toBe(AUDIT_ACTION_GUARDIAN_MISMATCH);
    expect((audit.after as Record<string, unknown>).ipAddress).toBe('10.0.0.5');
  });

  it('does not accept an inactive linked guardian', async () => {
    const { validation, repository } = buildMocks();
    repository.findLinkedGuardians.mockResolvedValue([{ ...linkedGuardian, active: false }]);
    const result = await validation.validateGuardian('300000020', '300000030', guard, meta);
    expect(result.authorized).toBe(false);
  });

  it('returns 404 when the student does not exist', async () => {
    const { validation, repository } = buildMocks();
    repository.findActiveStudent.mockResolvedValue(null as never);
    await expect(validation.validateGuardian('1', '2', guard, meta)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('StudentDeparturesService.register', () => {
  const base = { studentIdentifier: '300000020', guardianIdentifier: '300000030' };

  it('re-validates on the server: a forced authorization with the wrong guardian is stored as REJECTED and refused', async () => {
    const { service, saved } = buildMocks();
    await expect(
      service.register({ ...base, guardianIdentifier: '111111111' }, guard, meta),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(
      saved.some(
        (s) => s.entity === 'StudentDeparture' && s.value.status === DepartureStatus.REJECTED,
      ),
    ).toBe(true);
  });

  it('registers an authorized departure with the guardian relationship', async () => {
    const { service, saved } = buildMocks();
    const result = await service.register(base, guard, meta);
    expect(result.status).toBe(DepartureStatus.AUTHORIZED);
    const departure = saved.find((s) => s.entity === 'StudentDeparture')!.value;
    expect(departure.guardianId).toBe(7);
    expect(departure.relationship).toBe('Padre');
    expect(departure.departureType).toBe(DepartureType.REGULAR);
  });

  it('requires a reason for emergencies', async () => {
    const { service } = buildMocks();
    await expect(
      service.register({ ...base, departureType: DepartureType.EMERGENCY }, guard, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("completes today's scheduled permit in the same transaction", async () => {
    const { service, permitRepo } = buildMocks();
    permitRepo.findOne.mockResolvedValue({
      id: 'b3c2a1d0-0000-4000-8000-000000000001',
      studentId: student.id,
      status: ScheduledPermitStatus.PENDING,
      permitDate: costaRicaTodayBounds().date,
      reason: 'Cita médica',
    });
    const result = await service.register(
      { ...base, scheduledPermitId: 'b3c2a1d0-0000-4000-8000-000000000001' },
      guard,
      meta,
    );
    expect(result.scheduledPermitCompleted).toBe(true);
  });

  it('rejects a permit that belongs to another student', async () => {
    const { service, permitRepo } = buildMocks();
    permitRepo.findOne.mockResolvedValue({
      id: 'p',
      studentId: 999,
      status: ScheduledPermitStatus.PENDING,
      permitDate: costaRicaTodayBounds().date,
    });
    await expect(
      service.register({ ...base, scheduledPermitId: 'p' }, guard, meta),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("records a manual rejection with the guard's reason", async () => {
    const { service, saved } = buildMocks();
    const result = await service.register(
      { ...base, decision: DepartureStatus.REJECTED, justificationReason: 'Documento ilegible' },
      guard,
      meta,
    );
    expect(result.status).toBe(DepartureStatus.REJECTED);
    expect(saved.find((s) => s.entity === 'StudentDeparture')!.value.justificationReason).toBe(
      'Documento ilegible',
    );
  });

  it('keeps the linked guardian on a manual rejection and audits it as manual, not as a mismatch', async () => {
    const { service, saved } = buildMocks();
    await service.register(
      {
        ...base,
        decision: DepartureStatus.REJECTED,
        justificationReason: 'Encargado en estado inconveniente',
      },
      guard,
      meta,
    );
    const departure = saved.find((s) => s.entity === 'StudentDeparture')!.value;
    expect(departure.guardianId).toBe(linkedGuardian.id);
    expect(departure.relationship).toBe('Padre');
    expect(saved.find((s) => s.entity === 'AuditLog')!.value.action).toBe(
      AUDIT_ACTION_MANUAL_REJECTION,
    );
  });

  it('a manual rejection of an unlinked person stays unlinked', async () => {
    const { service, saved } = buildMocks();
    await service.register(
      {
        ...base,
        guardianIdentifier: '111111111',
        decision: DepartureStatus.REJECTED,
        justificationReason: 'No porta documento',
      },
      guard,
      meta,
    );
    const departure = saved.find((s) => s.entity === 'StudentDeparture')!.value;
    expect(departure.relationship).toBeNull();
  });
});
