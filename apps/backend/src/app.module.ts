import { Module } from '@nestjs/common';
import { CallModule } from './call/call.module';
import { AudioModule } from './audio/audio.module';

@Module({
  imports: [CallModule, AudioModule],
})
export class AppModule {}
