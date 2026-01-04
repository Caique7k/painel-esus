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
  async retryCall(callId: number) {
    const result = await this.pool.query(
      `
    UPDATE call
    SET status = 'waiting'
    WHERE id = $1
      AND status = 'called'
      AND expires_at > NOW()
      AND call_attempts < 3
    RETURNING id, call_attempts
    `,
      [callId],
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Chamada não pode ser refeita',
      };
    }

    return {
      success: true,
      callId,
      nextAttempt: result.rows[0].call_attempts + 1,
    };
  }

  async createCall(patientName: string, doctorName: string, sectorId: number) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // garante que o setor existe
      const sectorCheck = await client.query(
        `SELECT id FROM sector WHERE id = $1`,
        [sectorId],
      );

      if (sectorCheck.rows.length === 0) {
        throw new Error('Sector not found');
      }

      // cria chamada
      const callResult = await client.query(
        `
    INSERT INTO call (
      patient_name,
      doctor_name,
      sector_id,
      status,
      call_attempts,
      last_called_at,
      expires_at
    )
    VALUES ($1, $2, $3, 'waiting', 0, NULL, NULL)
    RETURNING *
  `,
        [patientName, doctorName, sectorId],
      );

      const callId = callResult.rows[0].id;

      await client.query('COMMIT');
      return callResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
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

  async getLastCall(sectorId: number) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
      SELECT *
      FROM call
      WHERE status = 'calling'
        AND sector_id = $1
      ORDER BY started_at DESC
      LIMIT 1
      `,
        [sectorId],
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }
  async getWaitingCalls(sectorId: number) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
      SELECT *
      FROM call
      WHERE status = 'waiting'
        AND sector_id = $1
      ORDER BY created_at ASC
      `,
        [sectorId],
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}
