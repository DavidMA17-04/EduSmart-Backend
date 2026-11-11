import { forwardRef, Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisher } from './realtime.publisher';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [RealtimeGateway, RealtimePublisher],
  exports: [RealtimePublisher, RealtimeGateway],
})
export class RealtimeModule {}
