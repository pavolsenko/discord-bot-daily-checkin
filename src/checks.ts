import {
    Channel,
    Client,
    Collection,
    Guild,
    GuildMember,
    Message,
} from 'discord.js';
import type { Pool } from 'mysql2/promise';

import type { AppConfig } from './config';
import {
    getDailyCount,
    incrementMissCount,
    updateDailyResult,
    getActiveEligibleUsers,
    getRandomInactiveUser,
    getUserStats,
    getUserWithLongestCheckStreak,
    getPreviousSeasonTopUser,
} from './db';
import { sendStatusMessage } from './message';

function formatDateInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
        throw new Error('Unable to format date in timezone');
    }

    return `${year}-${month}-${day}`;
}

async function fetchPostedUserIds(
    channel: Channel | null,
    sinceTimestamp: number
): Promise<Set<string>> {
    if (!channel || !channel.isTextBased()) {
        throw new Error('Configured channel is not a text-based guild channel');
    }

    const postedUserIds = new Set<string>();
    let before: string | undefined;

    while (true) {
        const batch: Collection<string, Message> = await channel.messages.fetch(
            {
                limit: 100,
                ...(before ? { before } : {}),
            }
        );

        if (batch.size === 0) {
            break;
        }

        const messages: Message[] = [...batch.values()].sort(
            (a: Message, b: Message): number =>
                b.createdTimestamp - a.createdTimestamp
        );

        for (const message of messages) {
            if (message.createdTimestamp < sinceTimestamp) {
                return postedUserIds;
            }

            postedUserIds.add(message.author.id);
        }

        if (batch.size < 100) {
            break;
        }

        const oldest = messages[messages.length - 1];
        if (!oldest) {
            break;
        }

        before = oldest.id;
    }

    return postedUserIds;
}

export async function runDailyCheck(
    client: Client,
    pool: Pool,
    config: AppConfig
): Promise<void> {
    const guild: Guild = await client.guilds.fetch(config.guildId);
    const channel: Channel | null = await guild.channels.fetch(
        config.channelId
    );

    const members: Collection<string, GuildMember> =
        await guild.members.fetch();

    const eligibleUsers = await getActiveEligibleUsers(pool);

    const eligibleMembers: Collection<string, GuildMember> = new Collection();

    for (const row of eligibleUsers) {
        const member = members.get(row.user_id);
        if (member) {
            eligibleMembers.set(member.id, member);
        }
    }

    const sinceTimestamp = Date.now() - 4 * 60 * 60 * 1000;
    const postedUserIds = await fetchPostedUserIds(channel, sinceTimestamp);
    const checkDate = formatDateInTimeZone(new Date(), config.timezone);

    const missedUserIds: string[] = [];

    for (const member of eligibleMembers.values()) {
        const posted = postedUserIds.has(member.id);
        const hasBadge = member.roles.cache.has(config.badgeRoleId);

        if (!posted) {
            missedUserIds.push(member.id);

            if (!hasBadge) {
                await member.roles.add(config.badgeRoleId);
            }

            await incrementMissCount({
                pool,
                guildId: config.guildId,
                userId: member.id,
            });
        } else if (hasBadge) {
            await member.roles.remove(config.badgeRoleId);
        }

        await updateDailyResult({
            pool,
            guildId: config.guildId,
            channelId: config.channelId,
            userId: member.id,
            checkDate,
            posted,
            badgeAwarded: !posted,
        });
    }

    const leaderboardResult = await getDailyCount(pool);
    const leaderboard = leaderboardResult[0];
    const honorableUserId = await getRandomInactiveUser(pool);

    let honorableStats: { userId: string; missedCount: number } | null = null;

    if (honorableUserId) {
        const stats = await getUserStats(pool, honorableUserId);

        honorableStats = {
            userId: honorableUserId,
            missedCount: stats ? stats.missed_count : 0,
        };
    }

    const longestStreak = await getUserWithLongestCheckStreak(pool);

    const previousSeasonWinner = await getPreviousSeasonTopUser(pool);

    await sendStatusMessage(
        channel,
        missedUserIds,
        leaderboard,
        honorableStats,
        longestStreak,
        previousSeasonWinner
    );
}
