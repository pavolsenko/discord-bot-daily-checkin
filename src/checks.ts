import { Client, GuildMember, TextBasedChannel, TextChannel } from 'discord.js';
import type { Pool } from 'mysql2/promise';
import type { AppConfig } from './config';
import { incrementMissCount, upsertDailyResult } from './db';

export type DailyCheckSummary = {
    checkDate: string;
    eligibleCount: number;
    postedCount: number;
    missedCount: number;
    missedUserIds: string[];
};

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

function isEligibleMember(
    member: GuildMember,
    excludedRoleIds: string[]
): boolean {
    if (member.user.bot) {
        return false;
    }

    if (excludedRoleIds.length === 0) {
        return true;
    }

    return !excludedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function fetchPostedUserIds(
    channel: TextBasedChannel,
    sinceTimestamp: number
): Promise<Set<string>> {
    const postedUserIds = new Set<string>();
    let before: string | undefined;

    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {}),
        });

        if (batch.size === 0) {
            break;
        }

        const messages = [...batch.values()].sort(
            (a, b) => b.createdTimestamp - a.createdTimestamp
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

async function sendSummaryMessage(options: {
    client: Client;
    channelId: string;
    summary: DailyCheckSummary;
}): Promise<void> {
    const { client, channelId, summary } = options;
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
        return;
    }

    await (channel as TextChannel).send({
        content: [
            `Daily check ${summary.checkDate}`,
            `Eligible: ${summary.eligibleCount}`,
            `Posted: ${summary.postedCount}`,
            `Missed: ${summary.missedCount}`,
        ].join(' | '),
        allowedMentions: { parse: [] },
    });
}

export async function runDailyCheck(options: {
    client: Client;
    pool: Pool;
    config: AppConfig;
}): Promise<DailyCheckSummary> {
    const { client, pool, config } = options;

    const guild = await client.guilds.fetch(config.guildId);
    const channel = await guild.channels.fetch(config.channelId);

    if (!channel || !channel.isTextBased()) {
        throw new Error('Configured channel is not a text-based guild channel');
    }

    const textChannel = channel as TextBasedChannel;
    const members = await guild.members.fetch();
    const eligibleMembers = members.filter((member) =>
        isEligibleMember(member, config.excludedRoleIds)
    );

    const sinceTimestamp = Date.now() - 24 * 60 * 60 * 1000;
    const postedUserIds = await fetchPostedUserIds(textChannel, sinceTimestamp);
    const checkDate = formatDateInTimeZone(new Date(), config.timezone);

    const missedUserIds: string[] = [];

    for (const member of eligibleMembers.values()) {
        const posted = postedUserIds.has(member.id);
        const hasBadge = member.roles.cache.has(config.badgeRoleId);

        if (!posted) {
            missedUserIds.push(member.id);

            if (!hasBadge) {
                await member.roles.add(
                    config.badgeRoleId,
                    'Missed the daily check'
                );
            }

            await incrementMissCount({
                pool,
                guildId: config.guildId,
                userId: member.id,
            });
        } else if (hasBadge) {
            await member.roles.remove(
                config.badgeRoleId,
                'Posted in the target channel'
            );
        }

        await upsertDailyResult({
            pool,
            guildId: config.guildId,
            channelId: config.channelId,
            userId: member.id,
            checkDate,
            posted,
            badgeAwarded: !posted,
        });
    }

    const summary: DailyCheckSummary = {
        checkDate,
        eligibleCount: members.size,
        postedCount: members.size - missedUserIds.length,
        missedCount: missedUserIds.length,
        missedUserIds,
    };

    await sendSummaryMessage({ client, channelId: config.channelId, summary });

    return summary;
}
