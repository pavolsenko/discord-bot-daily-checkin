import { Channel, GuildTextBasedChannel } from 'discord.js';
import { DailyCountRow } from './db';

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

    return message;
}

export async function sendStatusMessage(
    channel: Channel | null,
    missedUserIds: string[],
    leaderboard: DailyCountRow[],
    honorableStats: { userId: string; missedCount: number } | null
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
        ? `\nHonorable mention: <@${honorableStats.userId}> ` +
          honorableStats.missedCount +
          ' ⏰'
        : '\nHonorable mention: --';

    await (channel as GuildTextBasedChannel).send({
        content:
            `**⏰ ${getRandomGreeting()} Je <t:${Math.ceil(
                Date.now() / 1000
            )}:F>** ⏰\n` +
            `Dnešní budikári (${missedSize}): ${missedMembers || '--'}\n\n` +
            'Current leaderboard: \n' +
            createLeaderboard(leaderboard) +
            honorableMention +
            '\n\n' +
            'Full leaderboard at https://ranko.webtip.sk' +
            '\n' +
            'Ranko bot v1.2.4, kommandy: `/ranko join` `/ranko leave`',
    });
}
