import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TtsService } from './tts.service';
import { AudioCleanupService } from './audio-cleanup.service';

@Module({
  providers: [AudioService, TtsService, AudioCleanupService],
  controllers: [AudioController],
})
export class AudioModule {}
