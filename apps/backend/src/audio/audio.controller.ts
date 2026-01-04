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
  async stream(@Param('areaId') areaId: number, @Res() reply: FastifyReply) {
    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    reply.raw.write(': connected\n\n');

    this.audioService.registerClient(Number(areaId), reply.raw);
  }

  @Post('finish')
  async finish(@Body() body: { audioId: number }) {
    return this.audioService.finishAudio(body.audioId);
  }
}
