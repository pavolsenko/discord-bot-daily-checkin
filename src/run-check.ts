import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config';
import { createPool, initializeSchema } from './db';
import { runDailyCheck } from './checks';

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.database);

  await initializeSchema(pool);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
    ],
  });

  await client.login(config.discordToken);

  try {
    const summary = await runDailyCheck({ client, pool, config });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.destroy();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Manual check failed', error);
  process.exit(1);
});
