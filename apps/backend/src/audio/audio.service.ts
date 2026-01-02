import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AudioService {
  private pool: Pool;

  constructor() {
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

      await client.query('COMMIT');

      return {
        ...next.rows[0],
        attempt_number: call_attempts + 1, // isso vai pro painel / TTS
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
      SET status = 'finished',
          finished_at = NOW()
      WHERE id = (
        SELECT call_id FROM audio_queue WHERE id = $1
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
