import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateDisciplinaryCaseDto,
  SearchDisciplinaryStudentsQueryDto,
} from '../dto/create-disciplinary-case.dto';
import { CaseReasonDto } from '../dto/case-reason.dto';
import { SendFormalCommunicationDto } from '../dto/formal-communication.dto';
import { CloseFollowUpDto, CreateFollowUpDto } from '../dto/follow-up.dto';
import { InformationResponseDto, InvestigationMessageDto } from '../dto/investigation.dto';
import { ResolveDisciplinaryCaseDto } from '../dto/resolve-disciplinary-case.dto';
import { ListDisciplinaryCasesQueryDto } from '../dto/list-disciplinary-cases-query.dto';
import { StudentHistoryQueryDto } from '../dto/student-history-query.dto';
import { DisciplinaryCasesService } from '../services/disciplinary-cases.service';
import { DisciplinaryFollowUpService } from '../services/disciplinary-follow-up.service';
import { DisciplinaryInvestigationService } from '../services/disciplinary-investigation.service';

@ApiTags('Disciplinary - Expedientes')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryCasesController {
  constructor(
    private readonly cases: DisciplinaryCasesService,
    private readonly investigation: DisciplinaryInvestigationService,
    private readonly followUps: DisciplinaryFollowUpService,
  ) {}

  @Get('students')
  @Permissions(PERMISSIONS.DISCIPLINARY_CREATE)
  @ApiOperation({ summary: 'Buscar estudiantes con su sección activa para registrar una amonestación' })
  searchStudents(@Query() query: SearchDisciplinaryStudentsQueryDto) {
    return this.cases.searchStudents(query.q);
  }

  @Get('students/:studentId/history')
  @ApiOperation({ summary: 'Historial disciplinario y nota de conducta por período' })
  history(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: StudentHistoryQueryDto,
  ) {
    return this.cases.history(actor, studentId, query);
  }

  @Get('cases')
  @ApiOperation({ summary: 'Bandeja de expedientes, con alcance del actor y vencimiento del paso' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListDisciplinaryCasesQueryDto) {
    return this.cases.list(actor, query);
  }

  @Get('cases/:id')
  @ApiOperation({ summary: 'Detalle del expediente con cronología filtrada y plazo del paso' })
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.cases.findOne(actor, id);
  }

  @Post('cases/:id/investigation')
  @ApiOperation({ summary: 'Iniciar la investigación y el plazo de 10 días hábiles' })
  startInvestigation(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.investigation.start(actor, id);
  }

  @Post('cases/:id/observations')
  @ApiOperation({ summary: 'Registrar una observación de la investigación' })
  observe(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvestigationMessageDto,
  ) {
    return this.investigation.observe(actor, id, dto);
  }

  @Post('cases/:id/information-requests')
  @ApiOperation({ summary: 'Solicitar información al docente que reportó' })
  requestInformation(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvestigationMessageDto,
  ) {
    return this.investigation.requestInformation(actor, id, dto);
  }

  @Post('cases/:id/follow-ups')
  @ApiOperation({ summary: 'Registrar un seguimiento del profesor guía, Orientación o Dirección' })
  createFollowUp(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.followUps.create(actor, id, dto);
  }

  @Post('cases/:id/follow-ups/:followUpId/outcome')
  @ApiOperation({ summary: 'Marcar un compromiso como cumplido o incumplido' })
  closeFollowUp(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('followUpId', ParseIntPipe) followUpId: number,
    @Body() dto: CloseFollowUpDto,
  ) {
    return this.followUps.close(actor, id, followUpId, dto);
  }

  @Post('cases/:id/archive')
  @ApiOperation({ summary: 'Archivar por falta de mérito durante la investigación' })
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CaseReasonDto,
  ) {
    return this.investigation.archive(actor, id, dto);
  }

  @Post('cases/:id/annulment')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Anular el expediente con justificación y auditoría' })
  annul(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CaseReasonDto,
  ) {
    return this.investigation.annul(actor, id, dto);
  }

  @Post('cases/:id/formal-communication')
  @ApiOperation({ summary: 'Enviar la comunicación formal y abrir el plazo de descargo' })
  communicate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendFormalCommunicationDto,
  ) {
    return this.investigation.communicate(actor, id, dto);
  }

  @Post('cases/:id/resolution')
  @ApiOperation({ summary: 'Resolver el expediente: Desestima, Modifica o Mantiene' })
  resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDisciplinaryCaseDto,
  ) {
    return this.investigation.resolve(actor, id, dto);
  }

  @Post('cases/:id/counsel-requests')
  @ApiOperation({ summary: 'Solicitar el criterio de Orientación sin detener el expediente' })
  requestCounsel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvestigationMessageDto,
  ) {
    return this.investigation.requestCounsel(actor, id, dto);
  }

  @Post('cases/:id/counsel-opinions')
  @Permissions(PERMISSIONS.DISCIPLINARY_REVIEW)
  @ApiOperation({ summary: 'Emitir el criterio técnico de Orientación, reservado y no vinculante' })
  issueCounsel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InvestigationMessageDto,
  ) {
    return this.investigation.issueCounsel(actor, id, dto);
  }

  @Post('cases/:id/information-requests/response')
  @ApiOperation({ summary: 'Respuesta del docente que reportó a una solicitud de información' })
  respondInformation(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InformationResponseDto,
  ) {
    return this.investigation.respond(actor, id, dto);
  }

  @Post('cases')
  @Permissions(PERMISSIONS.DISCIPLINARY_CREATE)
  @ApiOperation({ summary: 'Registrar una amonestación y abrir el expediente' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateDisciplinaryCaseDto) {
    return this.cases.create(actor, dto);
  }
}
