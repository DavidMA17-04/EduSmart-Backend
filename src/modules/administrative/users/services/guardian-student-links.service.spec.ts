import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { GuardianStudentLinksService } from './guardian-student-links.service';

describe('GuardianStudentLinksService', () => {
  let links: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let users: { findById: jest.Mock };
  let service: GuardianStudentLinksService;

  const guardian = user(21, 'Encargado', 'Roberto', 'DiscQA');
  const student = user(22, 'Estudiante', 'Estudiante', 'DiscQA');

  beforeEach(() => {
    links = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((row) => row),
      remove: jest.fn(),
    };
    users = { findById: jest.fn() };
    service = new GuardianStudentLinksService(links as never, users as never);
  });

  it('alta: inserta el par Encargado–Estudiante y responde el vínculo', async () => {
    users.findById.mockImplementation(async (id: number) => (id === 21 ? guardian : student));
    links.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedLink());
    links.save.mockResolvedValue(persistedLink());

    const view = await service.create(22, 21, 'Madre');

    expect(links.save).toHaveBeenCalledWith(
      expect.objectContaining({
        guardianUserId: 21,
        studentUserId: 22,
        relationship: 'Madre',
      }),
    );
    expect(view.id).toBe(9);
    expect(view.guardianUserId).toBe(21);
    expect(view.studentUserId).toBe(22);
    expect(view.relationship).toBe('Madre');
  });

  it('duplicado: 409 si el par ya existe', async () => {
    users.findById.mockImplementation(async (id: number) => (id === 21 ? guardian : student));
    links.findOne.mockResolvedValue(persistedLink());

    await expect(service.create(21, 22)).rejects.toBeInstanceOf(ConflictException);
    expect(links.save).not.toHaveBeenCalled();
  });

  it('duplicado: 409 si el unique de BD dispara ER_DUP_ENTRY', async () => {
    users.findById.mockImplementation(async (id: number) => (id === 21 ? guardian : student));
    links.findOne.mockResolvedValue(null);
    links.save.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    await expect(service.create(21, 22)).rejects.toBeInstanceOf(ConflictException);
  });

  it('roles mal: 400 si la contraparte no es Encargado ni Estudiante', async () => {
    users.findById.mockImplementation(async (id: number) =>
      id === 21 ? guardian : user(8, 'Docente', 'María', 'Solano'),
    );

    await expect(service.create(21, 8)).rejects.toBeInstanceOf(BadRequestException);
    expect(links.save).not.toHaveBeenCalled();
  });

  it('listado DiscQA: el encargado ve al estudiante ligado', async () => {
    users.findById.mockResolvedValue(guardian);
    links.find.mockResolvedValue([persistedLink()]);

    const rows = await service.listForUser(21);

    expect(rows).toHaveLength(1);
    expect(rows[0].studentUserId).toBe(22);
    expect(rows[0].student.name).toContain('DiscQA');
  });

  it('baja: elimina un vínculo existente', async () => {
    const row = persistedLink();
    links.findOne.mockResolvedValue(row);
    links.remove.mockResolvedValue(row);

    await service.remove(9);
    expect(links.remove).toHaveBeenCalledWith(row);
  });

  it('baja: 404 si el vínculo no existe', async () => {
    links.findOne.mockResolvedValue(null);
    await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('alta: 404 si el usuario ancla no existe', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.create(99, 21)).rejects.toBeInstanceOf(NotFoundException);
  });
});

function user(id: number, role: string, name: string, last: string) {
  return {
    id,
    national_id: String(800000000 + id),
    nationalId: String(800000000 + id),
    name,
    first_lastname: last,
    second_lastname: null,
    email: `${name.toLowerCase()}@ctphojancha.ed.cr`,
    status: UserStatus.ACTIVE,
    userRoles: [{ role: { id: id, name: role, status: 'ACTIVE' } }],
    get roles() {
      return (this.userRoles ?? []).map((row: { role: { name: string } }) => row.role);
    },
  };
}

function persistedLink() {
  const guardian = user(21, 'Encargado', 'Roberto', 'DiscQA');
  const student = user(22, 'Estudiante', 'Estudiante', 'DiscQA');
  return {
    id: 9,
    guardianUserId: 21,
    studentUserId: 22,
    relationship: 'Madre',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    guardian,
    student,
  };
}
