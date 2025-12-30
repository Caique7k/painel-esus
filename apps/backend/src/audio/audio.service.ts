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

  async getNextAudio() {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Verifica se já existe áudio tocando
      const playing = await client.query(
        `SELECT id FROM audio_queue WHERE status = 'playing' LIMIT 1`,
      );

      if (playing.rows.length > 0) {
        await client.query('ROLLBACK');
        return null; // já tem áudio tocando
      }

      // Busca o próximo pendente
      const next = await client.query(
        `
        SELECT aq.id, c.patient_name, c.doctor_name, s.name AS sector
        FROM audio_queue aq
        JOIN call c ON c.id = aq.call_id
        JOIN sector s ON s.id = c.sector_id
        WHERE aq.status = 'pending'
        ORDER BY aq.created_at
        LIMIT 1
        `,
      );

      if (next.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const audioId = next.rows[0].id;

      // Marca como playing
      await client.query(
        `UPDATE audio_queue SET status = 'playing' WHERE id = $1`,
        [audioId],
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
      await client.query(
        `UPDATE audio_queue SET status = 'done' WHERE id = $1`,
        [audioId],
      );

      return { success: true };
    } finally {
      client.release();
    }
  }
}
