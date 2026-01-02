import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  // Painel pergunta: tem áudio pra tocar?
  @Get('next/:sectorId')
  async nextAudio(@Param('sectorId') sectorId: number) {
    return this.audioService.getNextAudio(Number(sectorId));
  }

  // Painel avisa: terminou de tocar
  @Post('finish')
  async finish(@Body() body: { audioId: number }) {
    return this.audioService.finishAudio(body.audioId);
  }
}
