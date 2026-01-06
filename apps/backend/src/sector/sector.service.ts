import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class SectorService {
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

  async findAllGroupedByArea() {
    const { rows } = await this.pool.query(`
      SELECT
        a.id   AS "areaId",
        a.name AS "areaName",
        s.id   AS "sectorId",
        s.name AS "sectorName"
      FROM area a
      JOIN sector s ON s.area_id = a.id
      ORDER BY a.name, s.name
    `);

    // 🔥 agrupar no backend (ideal pra extensão)
    const grouped = new Map<number, any>();

    for (const row of rows) {
      if (!grouped.has(row.areaId)) {
        grouped.set(row.areaId, {
          areaId: row.areaId,
          areaName: row.areaName,
          sectors: [],
        });
      }

      grouped.get(row.areaId).sectors.push({
        id: row.sectorId,
        name: row.sectorName,
      });
    }

    return Array.from(grouped.values());
  }
}
