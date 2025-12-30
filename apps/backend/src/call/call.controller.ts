import { Controller, Get, Post, Body } from '@nestjs/common';
import { CallService } from './call.service';

@Controller('call')
export class CallController {
  constructor(private readonly callService: CallService) {}

  // Endpoint para criar uma nova chamada
  @Post()
  async createCall(
    @Body() body: { patientName: string; doctorName: string; roomName: string },
  ) {
    const { patientName, doctorName, roomName } = body;
    return this.callService.createCall(patientName, doctorName, roomName);
  }

  // Endpoint para listar todas as chamadas
  @Get()
  async listCalls() {
    return this.callService.listCalls();
  }
}
