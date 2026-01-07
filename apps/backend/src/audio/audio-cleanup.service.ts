import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AudioCleanupService {
  private readonly AUDIO_DIR = path.resolve(process.cwd(), 'audios');
  private readonly MAX_AGE_MS = 5 * 60 * 1000;

  @Cron('*/5 * * * *')
  cleanup() {
    if (!fs.existsSync(this.AUDIO_DIR)) return;

    const now = Date.now();

    for (const file of fs.readdirSync(this.AUDIO_DIR)) {
      const filePath = path.join(this.AUDIO_DIR, file);

      let stats: fs.Stats;
      try {
        stats = fs.statSync(filePath);
      } catch {
        continue;
      }

      if (!stats.isFile()) continue;

      if (now - stats.mtimeMs > this.MAX_AGE_MS) {
        try {
          fs.unlinkSync(filePath);
          console.log('[AUDIO CLEANUP] removido:', file);
        } catch {
          console.warn('[AUDIO CLEANUP] falha ao remover:', file);
        }
      }
    }
  }
}
