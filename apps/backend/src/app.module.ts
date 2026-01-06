import { Module } from '@nestjs/common';
import { CallModule } from './call/call.module';
import { AudioModule } from './audio/audio.module';
import { SectorModule } from './sector/sector.module';

@Module({
  imports: [CallModule, AudioModule, SectorModule],
})
export class AppModule {}
