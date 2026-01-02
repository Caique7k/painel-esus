import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TtsService } from './tts.service';

@Injectable()
export class AudioService {
  private pool: Pool;

  constructor(private readonly ttsService: TtsService) {
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT),
    });
  }

  async getNextAudio(sectorId: number) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1️⃣ Verifica se já tem áudio tocando nesse setor
      const playing = await client.query(
        `
      SELECT 1
      FROM audio_queue aq
      JOIN call c ON c.id = aq.call_id
      WHERE aq.status = 'playing'
        AND c.sector_id = $1
      LIMIT 1
      `,
        [sectorId],
      );

      if (playing.rows.length > 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `
INSERT INTO audio_queue (call_id, status)
SELECT c.id, 'pending'
FROM call c
WHERE c.sector_id = $1
  AND c.status = 'waiting'
  AND c.call_attempts < 3
  AND c.expires_at < NOW()
  AND NOT EXISTS (
    SELECT 1 FROM audio_queue aq
    WHERE aq.call_id = c.id
      AND aq.status = 'pending'
  )
  `,
        [sectorId],
      );
      // 2️⃣ Busca próxima chamada válida
      const next = await client.query(
        `
      SELECT
        aq.id AS audio_id,
        aq.call_id,
        c.patient_name,
        c.doctor_name,
        c.call_attempts,
        s.name AS sector
      FROM audio_queue aq
      JOIN call c ON c.id = aq.call_id
      JOIN sector s ON s.id = c.sector_id
      WHERE aq.status = 'pending'
        AND c.sector_id = $1
        AND c.call_attempts < 3
        AND (
          c.expires_at IS NULL
          OR c.expires_at < NOW()
        )
      ORDER BY aq.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
      `,
        [sectorId],
      );

      if (next.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const { audio_id, call_id, call_attempts } = next.rows[0];
      const attempt = call_attempts + 1;

      // 3️⃣ Marca áudio como playing
      await client.query(
        `UPDATE audio_queue SET status = 'playing' WHERE id = $1`,
        [audio_id],
      );

      // 4️⃣ Atualiza a chamada
      await client.query(
        `
      UPDATE call
      SET
        status = 'calling',
        call_attempts = call_attempts + 1,
        last_called_at = NOW(),
        expires_at = NOW() + INTERVAL '5 minutes',
        started_at = NOW()
      WHERE id = $1
      `,
        [call_id],
      );
      const speechText =
        attempt === 1
          ? `Paciente ${next.rows[0].patient_name}, dirigir-se ao ${next.rows[0].sector} com ${next.rows[0].doctor_name}.`
          : `Paciente ${next.rows[0].patient_name}, dirigir-se ao ${next.rows[0].sector} com ${next.rows[0].doctor_name}. Chamada número ${attempt}.`;
      const audioUrl = await this.ttsService.generateAudio(speechText);
      await client.query(
        `
      UPDATE audio_queue
      SET
        audio_path = $1,
        audio_text = $2
      WHERE id = $3
  `,
        [audioUrl, speechText, audio_id],
      );
      await client.query('COMMIT');

      return {
        audioId: audio_id,
        callId: call_id,
        patientName: next.rows[0].patient_name,
        doctorName: next.rows[0].doctor_name,
        sector: next.rows[0].sector,
        attempt,
        text: speechText,
        audioUrl,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Finaliza o áudio atual
   */
  async finishAudio(audioId: number) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE audio_queue SET status = 'done' WHERE id = $1`,
        [audioId],
      );

      await client.query(
        `
      UPDATE call
SET status = 'waiting'
WHERE id = (
  SELECT call_id FROM audio_queue WHERE id = $1
)
AND call_attempts >= 3;
      
      `,
        [audioId],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
