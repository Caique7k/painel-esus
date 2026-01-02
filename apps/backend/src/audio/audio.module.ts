import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TtsService } from './tts.service';

@Module({
  providers: [AudioService, TtsService],
  controllers: [AudioController],
})
export class AudioModule {}
