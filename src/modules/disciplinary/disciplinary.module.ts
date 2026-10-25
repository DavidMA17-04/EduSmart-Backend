import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../integrations/mail/mail.module';
import { AuditLog } from '../administrative/users/entities/audit-log.entity';
import { DisciplinaryCommunicationsController } from './controllers/disciplinary-communications.controller';
import { DisciplinaryAlertsController } from './controllers/disciplinary-alerts.controller';
import { DisciplinaryAppealsController } from './controllers/disciplinary-appeals.controller';
import { DisciplinaryCalendarController } from './controllers/disciplinary-calendar.controller';
import { DisciplinaryCasesController } from './controllers/disciplinary-cases.controller';
import { DisciplinaryDashboardController } from './controllers/disciplinary-dashboard.controller';
import { DisciplinaryExportsController } from './controllers/disciplinary-exports.controller';
import { DisciplinaryEvidenceController } from './controllers/disciplinary-evidence.controller';
import { DisciplinaryPrecautionaryController } from './controllers/disciplinary-precautionary.controller';
import { InfractionTypesController } from './controllers/infraction-types.controller';
import { DisciplinaryAppealEntity } from './entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from './entities/disciplinary-case-event.entity';
import {
  DisciplinaryCaseEntity,
  DisciplinaryCaseSequenceEntity,
} from './entities/disciplinary-case.entity';
import {
  DisciplinaryCommunicationEntity,
  DisciplinaryNotificationEntity,
} from './entities/disciplinary-communication.entity';
import { DisciplinaryDefenseEntity } from './entities/disciplinary-defense.entity';
import { DisciplinaryEvidenceEntity } from './entities/disciplinary-evidence.entity';
import { DisciplinaryFollowUpEntity } from './entities/disciplinary-follow-up.entity';
import { DisciplinaryPrecautionaryMeasureEntity } from './entities/disciplinary-precautionary-measure.entity';
import { DisciplinarySettingsEntity } from './entities/disciplinary-settings.entity';
import { InfractionTypeEntity } from './entities/infraction-type.entity';
import { NonWorkingDayEntity } from './entities/non-working-day.entity';
import { DisciplinaryAccessService } from './services/disciplinary-access.service';
import { DisciplinaryAlertsService } from './services/disciplinary-alerts.service';
import { DisciplinaryAppealQueryService } from './services/disciplinary-appeal-query.service';
import { DisciplinaryAppealsService } from './services/disciplinary-appeals.service';
import { DisciplinaryCalendarService } from './services/disciplinary-calendar.service';
import { DisciplinaryCasesService } from './services/disciplinary-cases.service';
import { DisciplinaryCommunicationsService } from './services/disciplinary-communications.service';
import { DisciplinaryDefenseService } from './services/disciplinary-defense.service';
import { DisciplinaryDeliveryService } from './services/disciplinary-delivery.service';
import { DisciplinaryNotificationsService } from './services/disciplinary-notifications.service';
import { DisciplinaryPrecautionaryService } from './services/disciplinary-precautionary.service';
import { DisciplinaryEvidenceService } from './services/disciplinary-evidence.service';
import { DisciplinaryExportService } from './services/disciplinary-export.service';
import { DisciplinaryDashboardService } from './services/disciplinary-dashboard.service';
import { DisciplinaryDeadlineService } from './services/disciplinary-deadline.service';
import { DisciplinaryFollowUpService } from './services/disciplinary-follow-up.service';
import { DisciplinaryInvestigationService } from './services/disciplinary-investigation.service';
import { DisciplinaryWorkflowService } from './services/disciplinary-workflow.service';
import { InfractionTypesExportService } from './services/infraction-types-export.service';
import { InfractionTypesService } from './services/infraction-types.service';

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([
      InfractionTypeEntity,
      DisciplinaryCaseEntity,
      DisciplinaryCaseSequenceEntity,
      DisciplinaryEvidenceEntity,
      DisciplinaryCaseEventEntity,
      DisciplinaryCommunicationEntity,
      DisciplinaryNotificationEntity,
      DisciplinaryDefenseEntity,
      DisciplinaryAppealEntity,
      DisciplinaryPrecautionaryMeasureEntity,
      DisciplinaryFollowUpEntity,
      NonWorkingDayEntity,
      DisciplinarySettingsEntity,
      AuditLog,
    ]),
  ],
  controllers: [
    DisciplinaryCasesController,
    DisciplinaryDashboardController,
    DisciplinaryExportsController,
    DisciplinaryAppealsController,
    DisciplinaryAlertsController,
    DisciplinaryCommunicationsController,
    DisciplinaryEvidenceController,
    DisciplinaryCalendarController,
    InfractionTypesController,
    DisciplinaryPrecautionaryController,
  ],
  providers: [
    DisciplinaryCasesService,
    DisciplinaryCommunicationsService,
    DisciplinaryDefenseService,
    DisciplinaryDeliveryService,
    DisciplinaryNotificationsService,
    DisciplinaryPrecautionaryService,
    DisciplinaryEvidenceService,
    DisciplinaryExportService,
    InfractionTypesService,
    InfractionTypesExportService,
    DisciplinaryAccessService,
    DisciplinaryAppealsService,
    DisciplinaryAppealQueryService,
    DisciplinaryAlertsService,
    DisciplinaryDashboardService,
    DisciplinaryWorkflowService,
    DisciplinaryDeadlineService,
    DisciplinaryInvestigationService,
    DisciplinaryFollowUpService,
    DisciplinaryCalendarService,
  ],
  exports: [
    InfractionTypesService,
    DisciplinaryAccessService,
    DisciplinaryWorkflowService,
    DisciplinaryDeadlineService,
  ],
})
export class DisciplinaryModule {}
