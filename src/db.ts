import mysql, {
    FieldPacket,
    Pool,
    ResultSetHeader,
    RowDataPacket,
} from 'mysql2/promise';

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
            SELECT ubs.user_id, ubs.missed_count
            FROM user_badge_stats ubs
                INNER JOIN eligible_users eu
                    ON eu.user_id = ubs.user_id
                    AND eu.guild_id = ubs.guild_id
            WHERE eu.status = 1
            ORDER BY ubs.missed_count DESC;
        `
    );
}

export interface EligibleUserRow extends RowDataPacket {
    user_id: string;
    status: number;
}

export async function getActiveEligibleUsers(
    pool: Pool
): Promise<EligibleUserRow[]> {
    const [rows] = await pool.execute<EligibleUserRow[]>(
        `
            SELECT user_id, status
            FROM eligible_users
            WHERE status = 1;
        `
    );

    return rows;
}

export async function upsertEligibleUser(
    pool: Pool,
    guildId: string,
    userId: string
): Promise<void> {
    await pool.execute(
        `
            INSERT INTO eligible_users (
                guild_id,
                user_id,
                status
            ) VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                     status = 1,
                     updated_at = CURRENT_TIMESTAMP;
        `,
        [guildId, userId]
    );
}

export async function disableEligibleUser(
    pool: Pool,
    userId: string
): Promise<void> {
    await pool.execute(
        `
            UPDATE eligible_users
            SET status = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?;
        `,
        [userId]
    );
}

export interface RandomInactiveUserRow extends RowDataPacket {
    user_id: string;
}

export async function getRandomInactiveUser(
    pool: Pool
): Promise<string | null> {
    const [rows] = await pool.execute<RandomInactiveUserRow[]>(
        `
            SELECT user_id
            FROM eligible_users
            WHERE status = 0
            ORDER BY RAND()
                LIMIT 1;
        `
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0].user_id;
}

export interface UserStatsRow extends RowDataPacket {
    user_id: string;
    missed_count: number;
}

export async function getUserStats(
    pool: Pool,
    userId: string
): Promise<UserStatsRow | null> {
    const [rows] = await pool.execute<UserStatsRow[]>(
        `
        SELECT user_id, missed_count
        FROM user_badge_stats
        WHERE user_id = ?;
        `,
        [userId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
}

interface LogCommandOptions {
    pool: Pool;
    guildId: string;
    userId: string;
    commandName: string;
    subcommandName: string | null;
}

export async function logCommand(options: LogCommandOptions): Promise<void> {
    await options.pool.execute(
        `
        INSERT INTO command_logs (
            guild_id,
            user_id,
            command_name,
            subcommand_name
        ) VALUES (?, ?, ?, ?);
        `,
        [
            options.guildId,
            options.userId,
            options.commandName,
            options.subcommandName,
        ]
    );
}

export async function saveSeasonBadgeStatsSnapshot(
    pool: Pool,
    guildId: string,
    seasonId: number
): Promise<void> {
    await pool.execute<ResultSetHeader>(
        `
            INSERT INTO season_user_badge_stats (
                season_id,
                guild_id,
                user_id,
                missed_count
            )
            SELECT
                ? AS season_id,
                ubs.guild_id,
                ubs.user_id,
                ubs.missed_count
            FROM user_badge_stats ubs
            INNER JOIN eligible_users eu
                ON eu.user_id = ubs.user_id
                AND eu.guild_id = ubs.guild_id
            WHERE eu.status = 1
                AND ubs.guild_id = ?
            ON DUPLICATE KEY UPDATE
                missed_count = VALUES(missed_count);
        `,
        [seasonId, guildId]
    );
}

export async function resetUserBadgeStatsForGuild(
    pool: Pool,
    guildId: string
): Promise<void> {
    await pool.execute<ResultSetHeader>(
        `
            UPDATE user_badge_stats
            SET missed_count = 0,
                last_missed_at = NULL
            WHERE guild_id = ?;
        `,
        [guildId]
    );
}
