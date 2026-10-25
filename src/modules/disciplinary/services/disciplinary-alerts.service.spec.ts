import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryAlertsService } from './disciplinary-alerts.service';

describe('listado de notificaciones sin confirmar', () => {
  it('devuelve al responsable solo las que ya cumplieron 2 días hábiles', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('non_working_days') || sql.includes('teaching_assignments') || sql.includes('guardian_student_links')) {
        return [];
      }
      expect(sql).toContain('cases.id_users_responsible = ?');
      return [
        row(4, '2026-10-14T15:00:00.000Z'),
        row(5, '2026-10-16T15:00:00.000Z'),
      ];
    });
    const result = await new DisciplinaryAlertsService({ query } as never).listUnconfirmed(guide(), '2026-10-19');
    expect(result.items.map((item) => item.notificationId)).toEqual([4]);
    expect(result.items[0].message).toBe('Notificación sin confirmar');
  });

  it('Orientación ve las de todos los expedientes', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('disciplinary_notifications')) {
        expect(sql).not.toContain('id_users_responsible = ?');
        return [row(4, '2026-10-14T15:00:00.000Z')];
      }
      return [];
    });
    const result = await new DisciplinaryAlertsService({ query } as never).listUnconfirmed({
      id: 9,
      roles: ['Orientador'],
      permissions: [PERMISSIONS.DISCIPLINARY_READ],
    } as never);
    expect(result.items).toHaveLength(1);
  });

  it('niega el listado a quien no puede ver expedientes', async () => {
    const query = jest.fn();
    await expect(
      new DisciplinaryAlertsService({ query } as never).listUnconfirmed({
        id: 4,
        roles: ['Docente'],
        permissions: [],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
    await expect(
      new DisciplinaryAlertsService({ query } as never).list({
        id: 4,
        roles: ['Docente'],
        permissions: [],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('listado de alertas', () => {
  it('el guía de la sección ve la reincidencia y no el aviso institucional del calendario', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments')) return [{ groupId: 8 }];
      if (sql.includes('disciplinary_settings')) return [{ recidivismThreshold: 3, conductAlertThreshold: 80 }];
      if (sql.includes('FROM disciplinary_cases')) return [1, 2, 3].map((id) => caseAlert(id));
      return [];
    });
    const result = await new DisciplinaryAlertsService({ query } as never).list(guide(), '2026-10-19');
    expect(result.items.map((item) => item.code)).toEqual(['RECIDIVISM']);
  });

  it('Orientación ve el año sin días no hábiles y la sección sin docente guía', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('disciplinary_settings')) return [{ recidivismThreshold: 3, conductAlertThreshold: 80 }];
      if (sql.includes('FROM disciplinary_cases')) {
        expect(sql).not.toContain('id_users_responsible = ?');
        return [caseAlert(9, { groupId: 4, missingGuideTeacher: 1, responsibleUserId: null, stepBusinessDays: 0 })];
      }
      return [];
    });
    const result = await new DisciplinaryAlertsService({ query } as never).list(
      { id: 9, roles: ['Orientador'], permissions: [PERMISSIONS.DISCIPLINARY_READ] } as never,
      '2026-10-19',
    );
    expect(result.items.map((item) => item.message)).toEqual([
      'El año en curso no tiene días no hábiles',
      'Sin docente guía',
    ]);
  });

  it('el encargado no recibe alertas de personal sobre sus representados', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('disciplinary_settings')) return [{ recidivismThreshold: 3, conductAlertThreshold: 80 }];
      if (sql.includes('FROM disciplinary_cases')) return [1, 2, 3].map((id) => caseAlert(id));
      return [];
    });
    const result = await new DisciplinaryAlertsService({ query } as never).list(
      { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
      '2026-10-19',
    );
    expect(result.items).toEqual([]);
  });
});

function caseAlert(
  id: number,
  partial: {
    groupId?: number;
    missingGuideTeacher?: number;
    responsibleUserId?: number | null;
    stepBusinessDays?: number;
  } = {},
) {
  return {
    id,
    caseNumber: `AM-2026-000${id}`,
    studentUserId: 10,
    groupId: partial.groupId ?? 8,
    academicPeriodId: 4,
    status: 'REPORTED',
    severity: 'SERIOUS',
    responsibleUserId: partial.responsibleUserId === undefined ? 7 : partial.responsibleUserId,
    missingGuideTeacher: partial.missingGuideTeacher ?? 0,
    stepStartedOn: '2026-10-19',
    stepBusinessDays: partial.stepBusinessDays ?? 10,
  };
}

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function row(notificationId: number, issuedAt: string) {
  return {
    notificationId,
    caseId: 3,
    caseNumber: 'AM-2026-0008',
    responsibleUserId: 7,
    issuedAt: new Date(issuedAt),
  };
}
