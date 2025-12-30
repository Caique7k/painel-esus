import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class CallService {
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

  async createCall(
    patientName: string,
    doctorName: string,
    sectorName: string,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      //  garante setor
      const sectorResult = await client.query(
        `
        INSERT INTO sector (name)
        VALUES ($1)
        ON CONFLICT (name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
        `,
        [sectorName],
      );

      const sectorId = sectorResult.rows[0].id;

      // cria chamada
      const callResult = await client.query(
        `
        INSERT INTO call (
          patient_name,
          doctor_name,
          sector_id,
          status,
          started_at
        )
        VALUES ($1, $2, $3, 'calling', NOW())
        RETURNING *
        `,
        [patientName, doctorName, sectorId],
      );

      const call = callResult.rows[0];

      //  coloca na fila de áudio
      await client.query(
        `
        INSERT INTO audio_queue (call_id, status)
        VALUES ($1, 'pending')
        `,
        [call.id],
      );

      await client.query('COMMIT');
      return call;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listCalls() {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT
          c.id,
          c.patient_name,
          c.doctor_name,
          s.name AS sector,
          c.status,
          c.created_at
        FROM call c
        JOIN sector s ON s.id = c.sector_id
        ORDER BY c.created_at DESC
        `,
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}
