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

    if (month >= 1 && month <= 3) {
        return year * 10 + 1;
    }

    if (month >= 4 && month <= 6) {
        return year * 10 + 2;
    }

    if (month >= 7 && month <= 9) {
        return year * 10 + 3;
    }

    return year * 10 + 4;
}

export async function runSeasonEnd(
    client: Client,
    pool: Pool,
    config: AppConfig
): Promise<void> {
    if (!client.user) {
        throw new Error('Discord client user is missing');
    }

    const seasonId = getCurrentSeasonId(new Date());

    await saveSeasonBadgeStatsSnapshot(pool, config.guildId, seasonId);
    await resetUserBadgeStatsForGuild(pool, config.guildId);

    console.log(`Season ${seasonId} ended and badge stats were reset`);
}
