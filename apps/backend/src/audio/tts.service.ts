import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export class TtsService {
  private audioDir = path.resolve(process.cwd(), 'audios');

  constructor() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async generateAudio(text: string): Promise<string> {
    const fileName = `${randomUUID()}.mp3`;
    const outputPath = path.join(this.audioDir, fileName);

    try {
      await execFileAsync(
        'python',
        [
          '-m',
          'edge_tts',
          '--voice',
          'pt-BR-AntonioNeural',
          '--text',
          text,
          '--write-media',
          outputPath,
        ],
        { windowsHide: true },
      );
    } catch (err: any) {
      console.error('❌ ERRO AO GERAR TTS');
      console.error(err?.stderr || err);
      throw err;
    }

    return `/audios/${fileName}`;
  }
}
