import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Channel,
    EmbedBuilder,
    GuildTextBasedChannel,
} from 'discord.js';
import {
    DailyCountRow,
    LongestCheckStreakRow,
    PreviousSeasonTopRow,
} from './db';

const BASE_SEASON_YEAR = 2026;
const BASE_SEASON_MONTH = 6;
const DISCORD_EMBED_FIELD_LIMIT = 1024;

export function getRandomGreeting(): string {
    const greetings: string[] = [
        'Dobré ráno, čuráci!!!',
        'Dobré rejnou.',
        'Ránečko ospalci.',
        'Vstávať a cvičiť!',
        'Dobré ráno.',
        'Ránečko, lenivci!',
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
}

export function getRandomImage(): string {
    const images: string[] = [
        'https://ranko.webtip.sk/8a20a43c-ad45-467c-bb0b-e248491f7083.png',
        'https://ranko.webtip.sk/45eab406-2fc0-4afa-a766-ef737e7576bc.png',
        'https://ranko.webtip.sk/831601cf-b7c3-4bed-a4a5-a8410f010f54.png',
        'https://ranko.webtip.sk/1c692fd0-866a-4504-b667-1b5b5a5a12be.png',
        'https://ranko.webtip.sk/9d7cbd7b-57b2-4142-acf4-3f6703760bfc.png',
    ];

    return images[Math.floor(Math.random() * images.length)];
}

function getViennaDateParts(date: Date): { year: number; month: number } {
    const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Vienna',
        year: 'numeric',
        month: 'numeric',
    });

    const parts: Intl.DateTimeFormatPart[] = formatter.formatToParts(date);

    const yearPart: Intl.DateTimeFormatPart | undefined = parts.find(
        (part: Intl.DateTimeFormatPart): boolean => part.type === 'year'
    );

    const monthPart: Intl.DateTimeFormatPart | undefined = parts.find(
        (part: Intl.DateTimeFormatPart): boolean => part.type === 'month'
    );

    if (!yearPart || !monthPart) {
        throw new Error('Could not determine Vienna date parts');
    }

    return {
        year: Number(yearPart.value),
        month: Number(monthPart.value),
    };
}

function getMonthEndUtcDate(year: number, month: number): Date {
    const viennaSeasonEndHourUtc: number = month >= 3 && month <= 10 ? 8 : 9;

    return new Date(Date.UTC(year, month, 0, viennaSeasonEndHourUtc, 0, 0));
}

function getCurrentSeasonNumber(date: Date = new Date()): number {
    const { year, month } = getViennaDateParts(date);

    return (year - BASE_SEASON_YEAR) * 12 + (month - BASE_SEASON_MONTH);
}

const seasonNames: string[] = [
    'Budík Reborn',
    'Snooze Awakening',
    'Ranný Debuff',
    'Budík: Endgame',
    'Snooze Lord',
    'Budík Strikes Back',
    'Ranný Skill Issue',
    'Snooze Simulator',
    'Ranko Royale',
    'Dawn of the Budík',
    'Attack on Snooze',
    'Pán Budíkov: Návrat Budíka',
    'Ranný Nerf',
];

function getCurrentSeasonEndUnixTimestamp(date: Date = new Date()): number {
    const { year, month } = getViennaDateParts(date);
    const currentMonthEnd: Date = getMonthEndUtcDate(year, month);

    if (currentMonthEnd.getTime() > date.getTime()) {
        return Math.floor(currentMonthEnd.getTime() / 1000);
    }

    const nextMonthDate: Date = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const nextMonthParts: { year: number; month: number } =
        getViennaDateParts(nextMonthDate);
    const nextMonthEnd: Date = getMonthEndUtcDate(
        nextMonthParts.year,
        nextMonthParts.month
    );

    return Math.floor(nextMonthEnd.getTime() / 1000);
}

function truncateDiscordEmbedField(value: string): string {
    if (value.length <= DISCORD_EMBED_FIELD_LIMIT) {
        return value;
    }

    return value.slice(0, DISCORD_EMBED_FIELD_LIMIT - 3) + '...';
}

export function createLeaderboard(members: DailyCountRow[]): string {
    let message = '';

    const medals: string[] = ['🥇', '🥈', '🥉'];

    members
        .slice(0, 3)
        .forEach((member: DailyCountRow, index: number): void => {
            const tens: number = Math.floor(member.missed_count / 10) * 10;
            const units: number = member.missed_count % 10;

            message +=
                `${index in medals ? medals[index] : ' '} <@${member.user_id}> ` +
                `${tens > 0 ? `${tens} x ⏰ + ` : ''}` +
                (units ? Array(units).fill('⏰').join(' ') : '0') +
                '\n';
        });

    if (!message) {
        return '--';
    }

    return message;
}
export async function sendStatusMessage(
    channel: Channel | null,
    missedUserIds: string[],
    leaderboard: DailyCountRow[],
    honorableStats: { userId: string; missedCount: number } | null,
    longestCheckStreak: LongestCheckStreakRow | null,
    previousSeasonWinner: PreviousSeasonTopRow | null
): Promise<void> {
    if (!channel || !channel.isTextBased()) {
        throw new Error('Configured channel is not a text-based guild channel');
    }

    let missedSize: string = missedUserIds.length + ' kusov';

    if (missedUserIds.length === 1) {
        missedSize = '1 kus';
    } else if (missedUserIds.length > 1 && missedUserIds.length < 5) {
        missedSize = missedUserIds.length + ' kusy';
    }

    const missedMembers: string = missedUserIds
        .map((id: string): string => `<@${id}>`)
        .join(', ');

    const honorableMention: string = honorableStats
        ? `<@${honorableStats.userId}> ${honorableStats.missedCount ? honorableStats.missedCount + '⏰' : ''}`
        : '--';

    let longestCheckStreakMention: string = longestCheckStreak
        ? longestCheckStreak.length + ' dní'
        : '--';
    if (longestCheckStreak?.length === 1) {
        longestCheckStreakMention = '1 deň';
    } else if (
        longestCheckStreak?.length > 1 &&
        longestCheckStreak?.length < 5
    ) {
        longestCheckStreakMention = longestCheckStreak?.length + ' dni';
    }

    const seasonEndTimestamp: number = getCurrentSeasonEndUnixTimestamp();
    const seasonNumber: number = getCurrentSeasonNumber();
    const seasonName: string = seasonNames[seasonNumber] || 'Bonus Season';
    const currentTimestamp: number = Math.floor(Date.now() / 1000);

    const embedColor: number =
        missedUserIds.length === 0
            ? 0x22c55e
            : missedUserIds.length < 5
              ? 0xf59e0b
              : 0xef4444;

    const embed: EmbedBuilder = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`⏰ ${getRandomGreeting()} ⏰`)
        .setDescription(`Je <t:${currentTimestamp}:F>\n\n`)
        .setImage(getRandomImage())
        .addFields(
            {
                name: `Dnešní budikári (${missedSize})`,
                value: truncateDiscordEmbedField(missedMembers || '--'),
            },
            {
                name: 'Current leaderboard',
                value: truncateDiscordEmbedField(
                    createLeaderboard(leaderboard)
                ),
            },
            {
                name: 'Honorable mention',
                value: truncateDiscordEmbedField(honorableMention),
            },
            {
                name: 'Longest streak',
                value: truncateDiscordEmbedField(longestCheckStreakMention),
            },
            {
                name: `Sezóna ${seasonNumber} (${seasonName})`,
                value: `končí <t:${seasonEndTimestamp}:R>`,
            },
            {
                name: 'Víťaz minulej sezóny',
                value: previousSeasonWinner
                    ? `<@${previousSeasonWinner?.user_id}> ${previousSeasonWinner?.missed_count} ⏰`
                    : '--',
            }
        )
        .setFooter({
            text: 'Ranko bot v2.3.0 • /ranko join • /ranko leave',
        });

    const buttons: ActionRowBuilder<ButtonBuilder> =
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Leaderboard')
                .setStyle(ButtonStyle.Link)
                .setURL('https://ranko.webtip.sk'),
            new ButtonBuilder()
                .setLabel('Kúpiť Battle Pass')
                .setStyle(ButtonStyle.Link)
                .setURL('https://ranko.webtip.sk#buy')
        );

    await (channel as GuildTextBasedChannel).send({
        embeds: [embed],
        components: [buttons],
    });
}
