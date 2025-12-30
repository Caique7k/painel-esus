import { Controller, Get, Post, Body } from '@nestjs/common';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  // Painel pergunta: tem áudio pra tocar?
  @Get('next')
  async nextAudio() {
    return this.audioService.getNextAudio();
  }

  // Painel avisa: terminou de tocar
  @Post('finish')
  async finish(@Body() body: { audioId: number }) {
    return this.audioService.finishAudio(body.audioId);
  }
}
