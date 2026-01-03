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

      // 1️⃣ Verifica se já existe áudio tocando no setor
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

      // 2️⃣ Busca próxima chamada elegível
      const result = await client.query(
        `
      SELECT
        c.id AS call_id,
        c.patient_name,
        c.doctor_name,
        c.call_attempts,
        c.expires_at,
        s.name AS sector
      FROM call c
      JOIN sector s ON s.id = c.sector_id
      WHERE c.sector_id = $1
        AND c.status = 'waiting'
        AND c.call_attempts < 3
        AND (
          c.expires_at IS NULL
          OR c.expires_at > NOW()
        )
      ORDER BY c.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
      `,
        [sectorId],
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const call = result.rows[0];
      const attempt = call.call_attempts + 1;

      // 3️⃣ Texto do áudio
      const speechText =
        attempt === 1
          ? `Paciente ${call.patient_name}, dirigir-se ao ${call.sector} com ${call.doctor_name}.`
          : `Paciente ${call.patient_name}, dirigir-se ao ${call.sector} com ${call.doctor_name}. Chamada número ${attempt}.`;

      // 4️⃣ Gera áudio
      const audioUrl = await this.ttsService.generateAudio(speechText);

      // 5️⃣ Atualiza chamada (define expires_at só na primeira vez)
      await client.query(
        `
      UPDATE call
      SET
        status = 'calling',
        call_attempts = $1,
        last_called_at = NOW(),
        started_at = COALESCE(started_at, NOW()),
        expires_at = CASE
          WHEN expires_at IS NULL THEN NOW() + INTERVAL '5 minutes'
          ELSE expires_at
        END
      WHERE id = $2
      `,
        [attempt, call.call_id],
      );

      // 6️⃣ Cria áudio como playing
      const audioInsert = await client.query(
        `
      INSERT INTO audio_queue (
        call_id,
        status,
        audio_text,
        audio_path
      )
      VALUES ($1, 'playing', $2, $3)
      RETURNING id
      `,
        [call.call_id, speechText, audioUrl],
      );

      await client.query('COMMIT');

      return {
        audioId: audioInsert.rows[0].id,
        callId: call.call_id,
        patientName: call.patient_name,
        doctorName: call.doctor_name,
        sector: call.sector,
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

      // 1️⃣ Finaliza o áudio
      await client.query(
        `
      UPDATE audio_queue
      SET status = 'done'
      WHERE id = $1
      `,
        [audioId],
      );

      // 2️⃣ Atualiza status da chamada
      await client.query(
        `
      UPDATE call
      SET status = CASE
        WHEN call_attempts >= 3 OR expires_at < NOW()
          THEN 'no_show'
        ELSE 'waiting'
      END
      WHERE id = (
        SELECT call_id
        FROM audio_queue
        WHERE id = $1
      )
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
