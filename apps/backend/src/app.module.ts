import { Module } from '@nestjs/common';
import { CallModule } from './call/call.module';

@Module({
  imports: [CallModule],
})
export class AppModule {}
