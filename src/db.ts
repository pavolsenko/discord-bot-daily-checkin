import mysql, { FieldPacket, Pool, RowDataPacket } from 'mysql2/promise';

import type { DatabaseConfig } from './config';

export function createPool(config: DatabaseConfig): Pool {
    return mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectionLimit: config.connectionLimit,
        waitForConnections: true,
        namedPlaceholders: true,
    });
}

interface UpdateOptions {
    pool: Pool;
    guildId: string;
    channelId: string;
    userId: string;
    checkDate: string;
    posted: boolean;
    badgeAwarded: boolean;
}

export async function updateDailyResult(options: UpdateOptions): Promise<void> {
    await options.pool.execute(
        `
    INSERT INTO daily_check_results (
      guild_id,
      channel_id,
      user_id,
      check_date,
      posted,
      badge_awarded
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      posted = VALUES(posted),
      badge_awarded = VALUES(badge_awarded),
      checked_at = CURRENT_TIMESTAMP;
    `,
        [
            options.guildId,
            options.channelId,
            options.userId,
            options.checkDate,
            options.posted ? 1 : 0,
            options.badgeAwarded ? 1 : 0,
        ]
    );
}

interface IncrementOptions {
    pool: Pool;
    guildId: string;
    userId: string;
}

export async function incrementMissCount(
    options: IncrementOptions
): Promise<void> {
    await options.pool.execute(
        `
    INSERT INTO user_badge_stats (
      guild_id,
      user_id,
      missed_count,
      last_missed_at
    ) VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      missed_count = missed_count + 1,
      last_missed_at = CURRENT_TIMESTAMP;
    `,
        [options.guildId, options.userId]
    );
}

export interface DailyCountRow extends RowDataPacket {
    user_id: string;
    missed_count: number;
}

export async function getDailyCount(
    pool: Pool
): Promise<[DailyCountRow[], FieldPacket[]]> {
    return await pool.execute<DailyCountRow[]>(
        `
            SELECT user_id, missed_count
            FROM user_badge_stats
            ORDER BY missed_count DESC;
        `
    );
}
