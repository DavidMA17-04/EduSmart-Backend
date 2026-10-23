import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryDefenseEntity } from '../entities/disciplinary-defense.entity';
import { DisciplinaryEvidenceEntity } from '../entities/disciplinary-evidence.entity';
import { DisciplinaryDefenseService } from './disciplinary-defense.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

const TEXT = 'El estudiante no participó en los hechos que se le atribuyen.';

describe('descargo', () => {
  it('el encargado lo presenta en plazo, adjunta pruebas y deja el expediente pendiente de resolución', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: '2026-10-16', stepBusinessDays: 3 });
    const directory = mkdtempSync(join(tmpdir(), 'disciplinary-defense-'));
    (harness.service as unknown as { storageRoot: string }).storageRoot = directory;
    try {
      const result = await harness.service.fileFromPortal(guardian(), 3, { body: TEXT }, [
        pdf('descargo.pdf'),
        pdf('prueba.png', 'image/png'),
      ]);
      expect(result).toMatchObject({
        status: DisciplinaryCaseStatus.PENDING_RESOLUTION,
        channel: 'PORTAL',
        stepBusinessDays: 5,
      });
      expect(harness.row.status).toBe(DisciplinaryCaseStatus.PENDING_RESOLUTION);
      expect(harness.row.stepBusinessDays).toBe(5);
      expect(harness.evidences.map((item) => item.context)).toEqual(['DEFENSE', 'DEFENSE']);
      expect(harness.events.some((event) => event.type === 'DEFENSE_FILED' && event.payload?.recipientUserId === 7)).toBe(
        true,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rechaza más de 3 adjuntos, el plazo vencido y a un encargado no vinculado', async () => {
    const open = createHarness({ linked: true, stepStartedOn: '2026-10-16', stepBusinessDays: 3 });
    await expect(
      open.service.fileFromPortal(guardian(), 3, { body: TEXT }, [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'), pdf('d.pdf')]),
    ).rejects.toMatchObject({ response: { code: 'DEFENSE_FILES' } });
    expect(open.row.status).toBe(DisciplinaryCaseStatus.COMMUNICATED);

    const late = createHarness({ linked: true, stepStartedOn: '2026-10-01', stepBusinessDays: 3 });
    await expect(late.service.fileFromPortal(guardian(), 3, { body: TEXT })).rejects.toMatchObject({
      response: { code: 'DEFENSE_DEADLINE' },
    });
    expect(late.row.status).toBe(DisciplinaryCaseStatus.COMMUNICATED);
    expect(late.defenses).toHaveLength(0);

    const foreign = createHarness({ linked: false, stepStartedOn: '2026-10-16', stepBusinessDays: 3 });
    await expect(foreign.service.fileFromPortal(guardian(), 3, { body: TEXT })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('el responsable registra el descargo escrito con el documento', async () => {
    const harness = createHarness({ linked: false, stepStartedOn: '2026-10-16', stepBusinessDays: 3 });
    const directory = mkdtempSync(join(tmpdir(), 'disciplinary-defense-'));
    (harness.service as unknown as { storageRoot: string }).storageRoot = directory;
    try {
      await expect(harness.service.fileWritten(guide(), 3, { body: TEXT })).rejects.toMatchObject({
        response: { code: 'DEFENSE_DOCUMENT' },
      });
      const result = await harness.service.fileWritten(guide(), 3, { body: TEXT }, pdf('escrito.pdf'));
      expect(result.channel).toBe('WRITTEN');
      expect(harness.row.status).toBe(DisciplinaryCaseStatus.PENDING_RESOLUTION);
      expect(harness.evidences).toHaveLength(1);
      await expect(
        harness.service.fileWritten({ id: 8, roles: ['Docente'], permissions: [] } as never, 3, { body: TEXT }, pdf('otro.pdf')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('no acepta el descargo si el expediente no está comunicado', async () => {
    const harness = createHarness({
      linked: true,
      stepStartedOn: '2026-10-16',
      stepBusinessDays: 3,
      status: DisciplinaryCaseStatus.INVESTIGATING,
    });
    await expect(harness.service.fileFromPortal(guardian(), 3, { body: TEXT })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function guardian() {
  return { id: 70, roles: ['Encargado'], permissions: ['disciplinary.respond'] } as never;
}

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [] } as never;
}

function pdf(name: string, mimetype = 'application/pdf'): Express.Multer.File {
  return { originalname: name, mimetype, size: 8, buffer: Buffer.from('%PDF-1.4') } as Express.Multer.File;
}

function createHarness(input: {
  linked: boolean;
  stepStartedOn: string;
  stepBusinessDays: number;
  status?: DisciplinaryCaseStatus;
}) {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: input.status ?? DisciplinaryCaseStatus.COMMUNICATED,
    studentUserId: 10,
    responsibleUserId: 7,
    stepStartedOn: input.stepStartedOn,
    stepBusinessDays: input.stepBusinessDays,
  } as DisciplinaryCaseEntity;
  const defenses: Array<Record<string, unknown>> = [];
  const evidences: Array<Record<string, unknown>> = [];
  const events: Array<{ type: string; payload?: { recipientUserId?: number } }> = [];
  let nextId = 1;
  const defenseRepo = {
    count: async () => defenses.length,
    create: (value: Record<string, unknown>) => value,
    save: async (value: Record<string, unknown>) => {
      const stored = { id: nextId++, ...value };
      defenses.push(stored);
      return stored;
    },
  };
  const manager = {
    query: async () => [],
    update: async (entity: unknown, _id: number, patch: Partial<DisciplinaryCaseEntity>) => {
      if (entity === DisciplinaryCaseEntity) Object.assign(row, patch);
    },
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryDefenseEntity) return defenseRepo;
      if (entity === DisciplinaryEvidenceEntity) {
        return {
          create: (value: Record<string, unknown>) => value,
          save: async (value: Record<string, unknown>) => {
            const stored = { id: evidences.length + 1, ...value };
            evidences.push(stored);
            return stored;
          },
        };
      }
      if (entity === DisciplinaryCaseEventEntity) {
        return {
          create: (value: { type: string; payload?: { recipientUserId?: number } }) => value,
          save: async (value: { type: string; payload?: { recipientUserId?: number } }) => {
            events.push(value);
            return value;
          },
        };
      }
      if (entity === AuditLog) return { create: (value: unknown) => value, save: async (value: unknown) => value };
      throw new Error('Repositorio no previsto');
    },
  };
  const dataSource = {
    query: async () => (input.linked ? [{ studentUserId: 10 }] : []),
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  return {
    row,
    defenses,
    evidences,
    events,
    service: new DisciplinaryDefenseService(dataSource as never, new DisciplinaryWorkflowService()),
  };
}
