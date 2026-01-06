import { Controller, Get } from '@nestjs/common';
import { SectorService } from './sector.service';

@Controller('sector')
export class SectorController {
  constructor(private readonly sectorService: SectorService) {}

  @Get()
  async listByArea() {
    return this.sectorService.findAllGroupedByArea();
  }
}
