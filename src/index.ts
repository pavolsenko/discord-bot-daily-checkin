import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';

import { loadConfig } from './config';
import { createPool } from './db';
import { runDailyCheck } from './checks';
import { handleRankoCommand } from './commands';
import { runSeasonEnd } from './season';

async function main(): Promise<void> {
    const config = loadConfig();
    const pool = createPool(config.database);

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
        ],
    });

    await client.login(config.discordToken);

    client.once('ready', () => {
        if (!client.user) {
            throw new Error('Client is ready but user is missing');
        }

        console.log(`Logged in as ${client.user.tag}`);

        cron.schedule(
            `${config.checkMinute} ${config.checkHour} * * *`,
            async () => {
                try {
                    await runDailyCheck(client, pool, config);
                } catch (error) {
                    console.error('Daily check failed', error);
                }
            },
            { timezone: config.timezone }
        );

        cron.schedule(
            '0 10 31 3,12 *',
            async () => {
                try {
                    await runSeasonEnd(client, pool, config);
                } catch (error) {
                    console.error('Season end failed', error);
                }
            },
            { timezone: 'Europe/Vienna' }
        );

        cron.schedule(
            '0 10 30 6,9 *',
            async () => {
                try {
                    await runSeasonEnd(client, pool, config);
                } catch (error) {
                    console.error('Season end failed', error);
                }
            },
            { timezone: 'Europe/Vienna' }
        );
    });

    client.on('error', (error) => {
        console.error('Discord client error', error);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (interaction.commandName === 'ranko') {
            await handleRankoCommand(interaction, pool, config.guildId);
        }
    });

    process.on('SIGINT', async () => {
        await client.destroy();
        await pool.end();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await client.destroy();
        await pool.end();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('Fatal error', error);
    process.exit(1);
});
