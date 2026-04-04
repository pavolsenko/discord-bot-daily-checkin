import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';

import { loadConfig } from './config';
import { createPool } from './db';
import { runDailyCheck } from './checks';

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
                    const summary = await runDailyCheck(client, pool, config);
                    console.log(
                        `Check finished for ${summary.checkDate}: eligible=${summary.eligibleCount}, posted=${summary.postedCount}, missed=${summary.missedCount}`
                    );
                } catch (error) {
                    console.error('Daily check failed', error);
                }
            },
            { timezone: config.timezone }
        );
    });

    client.on('error', (error) => {
        console.error('Discord client error', error);
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
