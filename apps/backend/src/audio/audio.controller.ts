import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get('next/:sectorId')
  async nextAudio(@Param('sectorId') sectorId: number) {
    return this.audioService.getNextAudio(Number(sectorId));
  }

  @Get('stream/area/:areaId')
  stream(@Param('areaId') areaId: number, @Res() res: any) {
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:3000',
    });

    res.raw.write(': connected\n\n');

    this.audioService.registerClient(Number(areaId), res.raw);
  }

  @Post('finish')
  async finish(@Body() body: { audioId: number }) {
    return this.audioService.finishAudio(body.audioId);
  }
}
