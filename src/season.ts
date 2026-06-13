import type { Client } from 'discord.js';
import type { Pool } from 'mysql2/promise';
import type { AppConfig } from './config';

import {
    resetUserBadgeStatsForGuild,
    saveSeasonBadgeStatsSnapshot,
} from './db';

function getCurrentSeasonId(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return year * 100 + month;
}

export async function runSeasonEnd(
    client: Client,
    pool: Pool,
    config: AppConfig
): Promise<void> {
    if (!client.user) {
        throw new Error('Discord client user is missing');
    }

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const seasonId = getCurrentSeasonId(previousMonth);

    await saveSeasonBadgeStatsSnapshot(pool, config.guildId, seasonId);
    await resetUserBadgeStatsForGuild(pool, config.guildId);

    console.log(`Season ${seasonId} ended and badge stats were reset`);
}
