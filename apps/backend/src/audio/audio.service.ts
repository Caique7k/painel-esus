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

      const playing = await client.query(
        `
      SELECT aq.id
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

      const next = await client.query(
        `
      SELECT aq.id, aq.call_id, c.patient_name, c.doctor_name, s.name AS sector
      FROM audio_queue aq
      JOIN call c ON c.id = aq.call_id
      JOIN sector s ON s.id = c.sector_id
      WHERE aq.status = 'pending'
        AND c.sector_id = $1
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

      const { id: audioId, call_id: callId } = next.rows[0];

      await client.query(
        `UPDATE audio_queue SET status = 'playing' WHERE id = $1`,
        [audioId],
      );

      await client.query(
        `
      UPDATE call
      SET status = 'calling',
          started_at = NOW()
      WHERE id = $1
      `,
        [callId],
      );

      await client.query('COMMIT');
      return next.rows[0];
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
