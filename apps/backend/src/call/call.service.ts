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

  async createCall(patientName: string, doctorName: string, roomName: string) {
    const client = await this.pool.connect();
    try {
      // cria sala se não existir
      const roomResult = await client.query(
        `INSERT INTO room (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [roomName],
      );
      const roomId = roomResult.rows[0].id;

      // cria paciente se não existir
      const patientResult = await client.query(
        `INSERT INTO patient (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [patientName],
      );
      const patientId = patientResult.rows[0].id;

      // insere chamada
      const callResult = await client.query(
        `INSERT INTO call_history (patient_id, doctor_name, room_id, called_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [patientId, doctorName, roomId],
      );

      return callResult.rows[0];
    } finally {
      client.release();
    }
  }
  async listCalls() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT ch.id, p.name as patient_name, ch.doctor_name, r.name as room_name, ch.called_at
       FROM call_history ch
       JOIN patient p ON ch.patient_id = p.id
       JOIN room r ON ch.room_id = r.id
       ORDER BY ch.called_at DESC`,
      );
      return result.rows;
    } finally {
      client.release();
    }
  }
}
