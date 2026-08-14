import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipResponseWrap()
  @Get()
  @ApiOperation({ summary: 'Health check de la API' })
  check() {
    return {
      status: 'ok',
      service: 'EduSmart API',
    };
  }
}
