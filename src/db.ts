import mysql, { Pool } from 'mysql2/promise';
import type { AppConfig } from './config';

export function createPool(config: AppConfig['database']): Pool {
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

export async function initializeSchema(pool: Pool): Promise<void> {
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS daily_check_results (
      guild_id VARCHAR(32) NOT NULL,
      channel_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      check_date DATE NOT NULL,
      posted TINYINT(1) NOT NULL,
      badge_awarded TINYINT(1) NOT NULL DEFAULT 0,
      checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, channel_id, user_id, check_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

    await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_badge_stats (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      missed_count INT NOT NULL DEFAULT 0,
      last_missed_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (guild_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

export async function upsertDailyResult(options: {
    pool: Pool;
    guildId: string;
    channelId: string;
    userId: string;
    checkDate: string;
    posted: boolean;
    badgeAwarded: boolean;
}): Promise<void> {
    const { pool, guildId, channelId, userId, checkDate, posted, badgeAwarded } = options;

    await pool.execute(
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
        [guildId, channelId, userId, checkDate, posted ? 1 : 0, badgeAwarded ? 1 : 0]
    );
}

export async function incrementMissCount(options: { pool: Pool; guildId: string; userId: string }): Promise<void> {
    const { pool, guildId, userId } = options;

    await pool.execute(
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
        [guildId, userId]
    );
}
