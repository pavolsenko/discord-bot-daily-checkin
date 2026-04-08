import { Channel, GuildTextBasedChannel } from 'discord.js';
import { DailyCountRow } from './db';

export function getRandomGreeting() {
    const greetings = [
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

    const medals = ['🥇', '🥈', '🥉'];

    members.slice(0, 3).forEach((member: DailyCountRow, index: number) => {
        message +=
            `${index in medals ? medals[index] : ' '} <@${member.user_id}> ` +
            Array(member.missed_count).fill('⏰').join(' ') +
            '\n';
    });

    return message;
}

export async function sendStatusMessage(
    channel: Channel | null,
    missedUserIds: string[],
    leaderboard: DailyCountRow[]
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

    await (channel as GuildTextBasedChannel).send({
        content:
            `**⏰ ${getRandomGreeting()} Je <t:${Math.ceil(Date.now() / 1000)}:F>** ⏰\n` +
            `Dnešní budikári (${missedSize}): ${missedMembers || '--'}\n\n` +
            'Leaderboard: \n' +
            createLeaderboard(leaderboard),
    });
}
