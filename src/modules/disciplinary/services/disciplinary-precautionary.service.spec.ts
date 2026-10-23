import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { CommunicationKind, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryPrecautionaryMeasureEntity } from '../entities/disciplinary-precautionary-measure.entity';
import { DisciplinaryPrecautionaryService } from './disciplinary-precautionary.service';

const REASON = 'Retiro mientras se valora el riesgo para el grupo.';

describe('retiro precautorio', () => {
  it('registra 7 días naturales, notifica al encargado y no cambia la nota', async () => {
    const harness = createHarness();
    const result = await harness.service.order(director(), 3, {
      startsOn: '2026-10-19',
      endsOn: '2026-10-25',
      reason: REASON,
      paniCoordination: true,
    });
    expect(result).toMatchObject({
      days: 7,
      paniCoordination: true,
      status: DisciplinaryCaseStatus.INVESTIGATING,
      severity: InfractionSeverity.SERIOUS,
      deduction: 20,
    });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);
    expect(harness.row.severity).toBe(InfractionSeverity.SERIOUS);
    expect(harness.measures[0]).toMatchObject({ startsOn: '2026-10-19', endsOn: '2026-10-25', paniCoordination: true });
    expect(harness.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: CommunicationKind.PRECAUTIONARY }),
    );
    expect(String(harness.issue.mock.calls[0][1].body)).toContain('no afecta la nota de conducta');
  });

  it('rechaza 12 días naturales, una falta leve y a un docente', async () => {
    const harness = createHarness();
    await expect(
      harness.service.order(director(), 3, {
        startsOn: '2026-10-19',
        endsOn: '2026-10-30',
        reason: REASON,
        paniCoordination: false,
      }),
    ).rejects.toMatchObject({ response: { code: 'PRECAUTIONARY_DURATION' } });
    expect(harness.measures).toHaveLength(0);
    expect(harness.issue).not.toHaveBeenCalled();

    harness.row.severity = InfractionSeverity.MINOR;
    await expect(
      harness.service.order(director(), 3, {
        startsOn: '2026-10-19',
        endsOn: '2026-10-25',
        reason: REASON,
        paniCoordination: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    harness.row.severity = InfractionSeverity.SERIOUS;
    await expect(
      harness.service.order(
        { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE] } as never,
        3,
        { startsOn: '2026-10-19', endsOn: '2026-10-25', reason: REASON, paniCoordination: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el retiro sobre un expediente ya firme', async () => {
    const harness = createHarness();
    harness.row.status = DisciplinaryCaseStatus.FIRM;
    await expect(
      harness.service.order(director(), 3, {
        startsOn: '2026-10-19',
        endsOn: '2026-10-25',
        reason: REASON,
        paniCoordination: true,
      }),
    ).rejects.toMatchObject({ response: { code: 'PRECAUTIONARY_STAGE' } });
  });
});

function director() {
  return { id: 2, roles: ['Director'], permissions: [PERMISSIONS.DISCIPLINARY_PRECAUTIONARY] } as never;
}

function createHarness() {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.INVESTIGATING,
    severity: InfractionSeverity.SERIOUS,
    studentUserId: 10,
    caseNumber: 'AM-2026-0008',
  } as DisciplinaryCaseEntity;
  const measures: Array<Record<string, unknown>> = [];
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryPrecautionaryMeasureEntity) {
        return {
          create: (value: Record<string, unknown>) => value,
          save: async (value: Record<string, unknown>) => {
            const stored = { id: measures.length + 1, ...value };
            measures.push(stored);
            return stored;
          },
        };
      }
      if (entity === DisciplinaryCaseEventEntity || entity === AuditLog) {
        return { create: (value: unknown) => value, save: async (value: unknown) => value };
      }
      throw new Error('Repositorio no previsto');
    },
  };
  const dataSource = {
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const issue = jest.fn().mockResolvedValue({ communicationId: 9, pending: [], notified: true });
  const service = new DisciplinaryPrecautionaryService(
    dataSource as never,
    { issue, dispatch: jest.fn() } as never,
  );
  return { row, measures, issue, service };
}
