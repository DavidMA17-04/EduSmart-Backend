import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get('campus-snapshot')
  @ApiOperation({
    summary: 'Snapshot agregado del campus (sin autenticación)',
    description: 'Solo conteos. Sin datos personales.',
  })
  getCampusSnapshot() {
    return this.publicService.getCampusSnapshot();
  }
}
