import { Module } from '@nestjs/common';
import { CallModule } from './call/call.module';
import { AudioModule } from './audio/audio.module';
import { SectorModule } from './sector/sector.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [CallModule, AudioModule, SectorModule, ScheduleModule.forRoot()],
})
export class AppModule {}
