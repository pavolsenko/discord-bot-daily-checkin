import { Client, GatewayIntentBits } from 'discord.js';

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

    await runDailyCheck(client, pool, config);
}

main().catch((error) => {
    console.error('Manual check failed', error);
    process.exit(1);
});
