import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '../../../../common/constants/metadata.constant';
import { DashboardController } from '../../../dashboard/dashboard.controller';
import { AdministrativeReportsController } from './administrative-reports.controller';

describe('Reportes administrativos y resumen: permisos', () => {
  const reflector = new Reflector();

  it('todo /administrative-reports exige administrator.view', () => {
    expect(reflector.get(PERMISSIONS_KEY, AdministrativeReportsController)).toEqual([
      PERMISSIONS.ADMINISTRATOR_VIEW,
    ]);
  });

  it('/dashboard/summary exige administrator.view', () => {
    expect(reflector.get(PERMISSIONS_KEY, DashboardController)).toEqual([
      PERMISSIONS.ADMINISTRATOR_VIEW,
    ]);
  });
});
