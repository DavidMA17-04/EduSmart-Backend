import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryEvidenceService } from './disciplinary-evidence.service';

describe('descarga de evidencia', () => {
  it('responde 403 y no lee el archivo si el actor no ve el expediente', async () => {
    const cases = {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        studentUserId: 10,
        reporterUserId: 20,
        responsibleUserId: 30,
        groupId: 4,
        status: DisciplinaryCaseStatus.REPORTED,
        track: DisciplinaryTrack.DUE_PROCESS,
        severity: InfractionSeverity.SERIOUS,
      }),
    };
    const evidences = { findOne: jest.fn() };
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new DisciplinaryEvidenceService(
      dataSource as never,
      new DisciplinaryAccessService(),
      cases as never,
      evidences as never,
    );

    await expect(
      service.download(8, 3, {
        id: 50,
        email: 'docente@colegio.cr',
        roles: [],
        permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
        mustChangePassword: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(evidences.findOne).not.toHaveBeenCalled();
  });
});
