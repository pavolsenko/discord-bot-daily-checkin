import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Pool } from 'mysql2/promise';

import { upsertEligibleUser, disableEligibleUser, logCommand } from './db';

export const rankoCommand = new SlashCommandBuilder()
    .setName('ranko')
    .setDescription('Ranko commands')
    .addSubcommand((subcommand) =>
        subcommand.setName('join').setDescription('Join daily check')
    )
    .addSubcommand((subcommand) =>
        subcommand.setName('leave').setDescription('Leave daily check')
    );

export async function handleRankoCommand(
    interaction: ChatInputCommandInteraction,
    pool: Pool,
    guildId: string
): Promise<void> {
    if (!interaction.guildId || interaction.guildId !== guildId) {
        return;
    }

    const subcommand: string = interaction.options.getSubcommand();

    await logCommand({
        pool,
        guildId,
        userId: interaction.user.id,
        commandName: interaction.commandName,
        subcommandName: subcommand,
    });

    if (subcommand === 'join') {
        await upsertEligibleUser(pool, guildId, interaction.user.id);

        await interaction.reply({
            content: 'You joined.',
            ephemeral: true,
        });

        return;
    }

    if (subcommand === 'leave') {
        await disableEligibleUser(pool, interaction.user.id);

        await interaction.reply({
            content: 'You left.',
            ephemeral: true,
        });
    }
}
