import { Channel, GuildTextBasedChannel } from 'discord.js';
import { DailyCountRow } from './db';

export function createLeaderboard(members: DailyCountRow[]): string {
    let message = '';

    members.forEach((member) => {
        message +=
            `<@${member.user_id}> ` +
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
        .map((id: string) => `<@${id}>`)
        .join(', ');

    await (channel as GuildTextBasedChannel).send({
        content:
            `**⏰ Dobré ráno, čuráci!!! Je ${new Date().toLocaleString()}** ⏰\n` +
            `Dnešní budikári (${missedSize}): ${missedMembers || '--'}\n\n` +
            'Leaderboard: \n' +
            createLeaderboard(leaderboard),
    });
}
