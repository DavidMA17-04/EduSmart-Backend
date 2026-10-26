import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { EventVisibility } from '../constants/disciplinary.enums';
import {
  canViewCase,
  DisciplinaryActor,
  visibleEvents,
  visibleWitnesses,
} from './disciplinary-access.policy';

const facts = {
  studentUserId: 10,
  reporterUserId: 20,
  responsibleUserId: 30,
  groupId: 4,
};

function actor(partial: Partial<DisciplinaryActor> & Pick<DisciplinaryActor, 'userId'>): DisciplinaryActor {
  return {
    permissions: [],
    roleNames: [],
    guideGroupIds: [],
    linkedStudentIds: [],
    ...partial,
  };
}

describe('alcance disciplinario por actor', () => {
  it('Orientador, Director y Administrador ven todos los expedientes', () => {
    const viewer = actor({
      userId: 1,
      permissions: [PERMISSIONS.DISCIPLINARY_READ],
      roleNames: ['Orientador'],
    });
    expect(canViewCase(viewer, facts)).toBe(true);
  });

  it('el docente ve el expediente que reportó y el de su sección', () => {
    const reporter = actor({
      userId: 20,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Docente'],
    });
    const guide = actor({
      userId: 99,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Docente'],
      guideGroupIds: [4],
    });
    const outsider = actor({
      userId: 50,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Docente'],
      guideGroupIds: [8],
    });
    expect(canViewCase(reporter, facts)).toBe(true);
    expect(canViewCase(guide, facts)).toBe(true);
    expect(canViewCase(outsider, facts)).toBe(false);
  });

  it('el encargado solo ve a sus estudiantes vinculados', () => {
    const guardian = actor({
      userId: 70,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Encargado'],
      linkedStudentIds: [10],
    });
    const other = actor({
      userId: 71,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Encargado'],
      linkedStudentIds: [11],
    });
    expect(canViewCase(guardian, facts)).toBe(true);
    expect(canViewCase(other, facts)).toBe(false);
  });

  it('el estudiante solo ve sus propios expedientes', () => {
    const student = actor({
      userId: 10,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Estudiante'],
    });
    expect(canViewCase(student, facts)).toBe(true);
    expect(canViewCase(actor({ userId: 11, permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] }), facts)).toBe(
      false,
    );
  });

  it('view_own sin view alcanza; sin ninguno no', () => {
    expect(canViewCase(actor({ userId: 20, permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] }), facts)).toBe(
      true,
    );
    expect(canViewCase(actor({ userId: 20, permissions: [] }), facts)).toBe(false);
  });

  it('oculta criterio reservado y testigos a encargado y estudiante', () => {
    const guardian = actor({
      userId: 70,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Encargado'],
      linkedStudentIds: [10],
    });
    const student = actor({
      userId: 10,
      permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
      roleNames: ['Estudiante'],
    });
    const events = [
      { id: 1, visibility: EventVisibility.PUBLIC },
      { id: 2, visibility: EventVisibility.RESERVED },
    ];
    expect(visibleWitnesses(guardian, facts, 'Ana y Luis')).toBeNull();
    expect(visibleWitnesses(student, facts, 'Ana y Luis')).toBeNull();
    expect(visibleEvents(guardian, facts, events).map((event) => event.id)).toEqual([1]);
    expect(visibleEvents(student, facts, events).map((event) => event.id)).toEqual([1]);
  });

  it('el responsable, Orientación y Dirección ven lo reservado', () => {
    const events = [{ id: 2, visibility: EventVisibility.RESERVED }];
    const responsible = actor({ userId: 30, permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] });
    const counselor = actor({
      userId: 1,
      permissions: [PERMISSIONS.DISCIPLINARY_READ],
      roleNames: ['Orientador'],
    });
    const director = actor({
      userId: 2,
      permissions: [PERMISSIONS.DISCIPLINARY_READ],
      roleNames: ['Director'],
    });
    expect(visibleEvents(responsible, facts, events)).toHaveLength(1);
    expect(visibleWitnesses(counselor, facts, 'Ana y Luis')).toBe('Ana y Luis');
    expect(visibleWitnesses(director, facts, 'Ana y Luis')).toBe('Ana y Luis');
    expect(visibleEvents(director, facts, events)).toHaveLength(1);
  });
});
