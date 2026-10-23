import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryNotificationsService } from './disciplinary-notifications.service';

describe('bandeja del encargado', () => {
  it('muestra las notificaciones de sus representados y el contador de no leídas', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain('guardian_student_links');
      expect(sql).toContain('n.id_users_guardian = ?');
      expect(params).toEqual([70]);
      return [
        inboxRow({ id: 1, studentUserId: 10, studentName: 'Luis', readAt: null }),
        inboxRow({ id: 2, studentUserId: 11, studentName: 'María', readAt: new Date('2026-10-18T18:00:00.000Z') }),
      ];
    });
    const result = await new DisciplinaryNotificationsService({ query } as never).mine(guardian());
    expect(result.unreadCount).toBe(1);
    expect(result.items.map((item) => item.studentName)).toEqual(['Luis', 'María']);
    expect(result.items.map((item) => item.studentUserId)).toEqual([10, 11]);
  });

  it('niega la bandeja a quien no puede ver expedientes', async () => {
    const query = jest.fn();
    await expect(
      new DisciplinaryNotificationsService({ query } as never).mine({
        id: 4,
        roles: ['Docente'],
        permissions: [PERMISSIONS.DISCIPLINARY_CREATE],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('confirma la lectura con fecha, IP y agente, y no la modifica después', async () => {
    const state = {
      readAt: null as Date | null,
      readIp: null as string | null,
      readUserAgent: null as string | null,
    };
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('UPDATE')) {
        if (!state.readAt) {
          state.readAt = params[0] as Date;
          state.readIp = params[1] as string;
          state.readUserAgent = params[2] as string;
        }
        return { affectedRows: state.readAt ? 1 : 0 };
      }
      if (params[1] !== 70) return [];
      return [receiptRow(state)];
    });
    const service = new DisciplinaryNotificationsService({ query } as never);
    const first = await service.confirmRead(guardian(), 5, { ipAddress: '10.0.0.8', userAgent: 'EduSmart' });
    expect(first.label).toContain('Leída por Ana Sol el');
    expect(first.readIp).toBe('10.0.0.8');
    expect(first.readUserAgent).toBe('EduSmart');

    const second = await service.confirmRead(guardian(), 5, { ipAddress: '10.9.9.9', userAgent: 'otro' });
    expect(second.readIp).toBe('10.0.0.8');
    expect(second.readUserAgent).toBe('EduSmart');
    expect(second.readAt).toBe(first.readAt);
  });

  it('no confirma la notificación de otro encargado', async () => {
    const query = jest.fn(async () => []);
    await expect(
      new DisciplinaryNotificationsService({ query } as never).confirmRead(guardian(), 5, {
        ipAddress: '10.0.0.8',
        userAgent: 'EduSmart',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function guardian() {
  return { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function inboxRow(partial: { id: number; studentUserId: number; studentName: string; readAt: Date | null }) {
  return {
    id: partial.id,
    communicationId: 3,
    caseId: 8,
    caseNumber: 'AM-2026-0008',
    kind: 'FORMAL_CHARGE',
    studentUserId: partial.studentUserId,
    studentName: partial.studentName,
    studentFirstLastname: null,
    studentSecondLastname: null,
    issuedAt: new Date('2026-10-16T18:00:00.000Z'),
    readAt: partial.readAt,
  };
}

function receiptRow(state: { readAt: Date | null; readIp: string | null; readUserAgent: string | null }) {
  return {
    ...inboxRow({ id: 5, studentUserId: 10, studentName: 'Luis', readAt: state.readAt }),
    readIp: state.readIp,
    readUserAgent: state.readUserAgent,
    guardianName: 'Ana',
    guardianFirstLastname: 'Sol',
    guardianSecondLastname: null,
  };
}
