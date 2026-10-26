import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { JustificationStatus } from '../../common/enums/justification-status.enum';
import { InboxNotificationsService } from './inbox-notifications.service';
import { InboxSource } from './inbox.constants';

describe('bandeja unificada in-app', () => {
  it('el encargado solo ve disciplina de sus representados', async () => {
    const disciplinary = {
      mine: jest.fn().mockResolvedValue({
        unreadCount: 1,
        items: [
          disciplinaryItem({ id: 1, studentName: 'Luis', readAt: null }),
        ],
      }),
    };
    const service = build({ disciplinary });
    const result = await service.mine(guardian());
    expect(disciplinary.mine).toHaveBeenCalled();
    expect(result.unreadCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 1,
        source: InboxSource.DISCIPLINARY,
        href: '/admin/discipline/notifications',
        title: 'Comunicación formal · Luis',
        readAt: null,
      }),
    ]);
  });

  it('omite avisos disciplinarios ya leídos', async () => {
    const disciplinary = {
      mine: jest.fn().mockResolvedValue({
        unreadCount: 1,
        items: [
          disciplinaryItem({ id: 1, studentName: 'Luis', readAt: null }),
          disciplinaryItem({
            id: 2,
            studentName: 'María',
            readAt: '2026-10-18T18:00:00.000Z',
          }),
        ],
      }),
    };
    const result = await build({ disciplinary }).mine(guardian());
    expect(result.items.map((item) => item.id)).toEqual([1]);
    expect(result.unreadCount).toBe(1);
  });

  it('el docente solo ve ausentismo de su alcance', async () => {
    const absenteeism = {
      listUnreadForInbox: jest.fn().mockResolvedValue([
        {
          id: 9,
          title: 'Alerta de ausentismo — riesgo alto',
          body: '4 ausencias',
          studentFullName: 'Kevin Salazar',
          sentAt: '2026-10-20T12:00:00.000Z',
          readAt: null,
        },
      ]),
    };
    const result = await build({ absenteeism }).mine(teacher());
    expect(absenteeism.listUnreadForInbox).toHaveBeenCalled();
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 9,
        source: InboxSource.ABSENTEEISM,
        href: '/admin/attendance/alerts',
      }),
    ]);
    expect(result.items.some((item) => item.source === InboxSource.JUSTIFICATION_PENDING)).toBe(
      false,
    );
  });

  it('sin attendance.review no incluye justificaciones pendientes', async () => {
    const justifications = { getJustifications: jest.fn() };
    const result = await build({ justifications }).mine(teacher());
    expect(justifications.getJustifications).not.toHaveBeenCalled();
    expect(result.items.some((item) => item.source === InboxSource.JUSTIFICATION_PENDING)).toBe(
      false,
    );
  });

  it('el revisor ve justificaciones PENDING de su alcance', async () => {
    const justifications = {
      getJustifications: jest.fn().mockResolvedValue({
        data: [
          {
            id: 44,
            status: JustificationStatus.PENDING,
            createdAt: new Date('2026-10-21T08:00:00.000Z'),
            sessionDate: '2026-10-20',
            student: { fullName: 'Diego Rojas' },
            offering: { name: 'Matemática' },
          },
        ],
      }),
    };
    const result = await build({ justifications }).mine(reviewer());
    expect(justifications.getJustifications).toHaveBeenCalledWith(
      expect.objectContaining({ status: JustificationStatus.PENDING }),
      expect.objectContaining({ id: 8 }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 44,
        source: InboxSource.JUSTIFICATION_PENDING,
        href: '/admin/attendance/justifications',
        readAt: null,
      }),
    );
  });

  it('mezcla fuentes y alinea unreadCount', async () => {
    const result = await build({
      disciplinary: {
        mine: jest.fn().mockResolvedValue({
          items: [disciplinaryItem({ id: 1, issuedAt: '2026-10-21T10:00:00.000Z' })],
        }),
      },
      absenteeism: {
        listUnreadForInbox: jest.fn().mockResolvedValue([
          unreadAbsenteeism({ id: 2, sentAt: '2026-10-21T09:00:00.000Z' }),
          unreadAbsenteeism({ id: 3, sentAt: '2026-10-21T08:00:00.000Z' }),
        ]),
      },
      justifications: {
        getJustifications: jest.fn().mockResolvedValue({
          data: [
            pendingJustification({
              id: 4,
              createdAt: new Date('2026-10-21T07:00:00.000Z'),
            }),
          ],
        }),
      },
    }).mine(counselor());
    expect(result.unreadCount).toBe(4);
    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('estudiante o actor sin fuentes recibe 200 vacío', async () => {
    const disciplinary = { mine: jest.fn() };
    const absenteeism = { listUnreadForInbox: jest.fn() };
    const justifications = { getJustifications: jest.fn() };
    const result = await build({ disciplinary, absenteeism, justifications }).mine(student());
    expect(result).toEqual({ unreadCount: 0, items: [] });
    expect(disciplinary.mine).not.toHaveBeenCalled();
    expect(absenteeism.listUnreadForInbox).not.toHaveBeenCalled();
    expect(justifications.getJustifications).not.toHaveBeenCalled();
  });

  it('si la fuente niega acceso, la bandeja queda vacía en vez de 403', async () => {
    const disciplinary = {
      mine: jest.fn().mockRejectedValue(new ForbiddenException('No tiene acceso')),
    };
    const result = await build({ disciplinary }).mine(guardian());
    expect(result).toEqual({ unreadCount: 0, items: [] });
  });

  it('IDOR de listado: B no ve el ítem de A', async () => {
    const disciplinary = {
      mine: jest.fn().mockImplementation(async (actor: { id: number }) => ({
        items:
          actor.id === 70
            ? [disciplinaryItem({ id: 1, studentName: 'Luis' })]
            : [],
      })),
    };
    const service = build({ disciplinary });
    const ofA = await service.mine(guardian());
    const ofB = await service.mine({
      id: 71,
      roles: ['Encargado'],
      permissions: [PERMISSIONS.DISCIPLINARY_RESPOND, PERMISSIONS.DISCIPLINARY_VIEW_OWN],
    } as never);
    expect(ofA.items.map((item) => item.id)).toEqual([1]);
    expect(ofB.items).toEqual([]);
  });

  it('confirma disciplina propia y omite el ítem después', async () => {
    const state = { readAt: null as string | null };
    const disciplinary = {
      mine: jest.fn().mockImplementation(async () => ({
        items: state.readAt
          ? []
          : [disciplinaryItem({ id: 5, readAt: null })],
      })),
      confirmRead: jest.fn().mockImplementation(async () => {
        state.readAt = '2026-10-21T12:00:00.000Z';
        return { id: 5, readAt: state.readAt };
      }),
    };
    const service = build({ disciplinary });
    await service.markRead(guardian(), InboxSource.DISCIPLINARY, 5, meta());
    const after = await service.mine(guardian());
    expect(disciplinary.confirmRead).toHaveBeenCalledWith(guardian(), 5, meta());
    expect(after.items).toEqual([]);
    expect(after.unreadCount).toBe(0);
  });

  it('la segunda confirmación disciplinaria se delega y no se reabre el ítem', async () => {
    const disciplinary = {
      mine: jest.fn().mockResolvedValue({ items: [] }),
      confirmRead: jest
        .fn()
        .mockResolvedValueOnce({ id: 5, readAt: '2026-10-21T12:00:00.000Z' })
        .mockResolvedValueOnce({ id: 5, readAt: '2026-10-21T12:00:00.000Z' }),
    };
    const service = build({ disciplinary });
    const first = await service.markRead(guardian(), InboxSource.DISCIPLINARY, 5, meta());
    const second = await service.markRead(guardian(), InboxSource.DISCIPLINARY, 5, {
      ipAddress: '10.9.9.9',
      userAgent: 'otro',
    });
    expect(first.readAt).toBe(second.readAt);
    expect(disciplinary.confirmRead).toHaveBeenCalledTimes(2);
    const after = await service.mine(guardian());
    expect(after.items).toEqual([]);
  });

  it('rechaza acuse de ausentismo ajeno', async () => {
    const absenteeism = {
      markNotificationRead: jest.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ABSENTEEISM_NOTIFICATION_FORBIDDEN',
          message: 'No puede marcar esta notificación',
        }),
      ),
    };
    await expect(
      build({ absenteeism }).markRead(teacher(), InboxSource.ABSENTEEISM, 9, meta()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza acuse de ítem inexistente', async () => {
    const disciplinary = {
      confirmRead: jest.fn().mockRejectedValue(new NotFoundException('La notificación no existe')),
    };
    await expect(
      build({ disciplinary }).markRead(guardian(), InboxSource.DISCIPLINARY, 99, meta()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no acusa justificaciones pendientes', async () => {
    await expect(
      build({}).markRead(reviewer(), InboxSource.JUSTIFICATION_PENDING, 44, meta()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function build(partial: {
  disciplinary?: Partial<{ mine: jest.Mock; confirmRead: jest.Mock }>;
  absenteeism?: Partial<{ listUnreadForInbox: jest.Mock; markNotificationRead: jest.Mock }>;
  justifications?: Partial<{ getJustifications: jest.Mock }>;
} = {}) {
  return new InboxNotificationsService(
    {
      mine: jest.fn().mockResolvedValue({ items: [] }),
      confirmRead: jest.fn(),
      ...partial.disciplinary,
    } as never,
    {
      listUnreadForInbox: jest.fn().mockResolvedValue([]),
      markNotificationRead: jest.fn(),
      ...partial.absenteeism,
    } as never,
    {
      getJustifications: jest.fn().mockResolvedValue({ data: [] }),
      ...partial.justifications,
    } as never,
  );
}

function guardian() {
  return {
    id: 70,
    roles: ['Encargado'],
    permissions: [PERMISSIONS.DISCIPLINARY_RESPOND, PERMISSIONS.DISCIPLINARY_VIEW_OWN],
  } as never;
}

function teacher() {
  return {
    id: 7,
    roles: ['Docente'],
    permissions: [PERMISSIONS.ATTENDANCE_READ],
  } as never;
}

function reviewer() {
  return {
    id: 8,
    roles: ['Orientador'],
    permissions: [PERMISSIONS.ATTENDANCE_REVIEW, PERMISSIONS.ATTENDANCE_READ],
  } as never;
}

function counselor() {
  return {
    id: 8,
    roles: ['Orientador'],
    permissions: [
      PERMISSIONS.DISCIPLINARY_RESPOND,
      PERMISSIONS.DISCIPLINARY_VIEW_OWN,
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.ATTENDANCE_REVIEW,
    ],
  } as never;
}

function student() {
  return {
    id: 20,
    roles: ['Estudiante'],
    permissions: [PERMISSIONS.ATTENDANCE_VIEW_OWN],
  } as never;
}

function meta() {
  return { ipAddress: '10.0.0.8', userAgent: 'EduSmart' };
}

function disciplinaryItem(partial: {
  id: number;
  studentName?: string;
  readAt?: string | null;
  issuedAt?: string;
}) {
  return {
    id: partial.id,
    kind: 'FORMAL_CHARGE',
    studentName: partial.studentName ?? 'Luis',
    caseNumber: 'AM-2026-0007',
    issuedAt: partial.issuedAt ?? '2026-10-21T10:00:00.000Z',
    readAt: partial.readAt === undefined ? null : partial.readAt,
  };
}

function unreadAbsenteeism(partial: { id: number; sentAt: string }) {
  return {
    id: partial.id,
    title: 'Alerta de ausentismo — en observación',
    body: '3 ausencias',
    studentFullName: 'Laura Vargas',
    sentAt: partial.sentAt,
    readAt: null,
  };
}

function pendingJustification(partial: { id: number; createdAt: Date }) {
  return {
    id: partial.id,
    status: JustificationStatus.PENDING,
    createdAt: partial.createdAt,
    sessionDate: '2026-10-20',
    student: { fullName: 'Diego Rojas' },
    offering: { name: 'Matemática' },
  };
}
