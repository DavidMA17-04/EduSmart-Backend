import { CommunicationTargetingService } from './communication-targeting.service';

describe('audiencias de comunicados', () => {
  it('normaliza alias institucionales sin elevar un rol personalizado por substring', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    const service = new CommunicationTargetingService(db as any, {} as any);
    const context = await service.getUserTargetContext(5, ['Ayudante admin', 'TEACHER', 'GUARDIAN', 'COUNSELOR']);
    expect(context.roleNames).toEqual(expect.arrayContaining(['Ayudante admin', 'Docente', 'Encargado', 'Padre de familia', 'Orientador']));
    expect(context.roleNames).not.toContain('ADMIN');
    expect(context.roleNames).not.toContain('Administrador');
  });
});
