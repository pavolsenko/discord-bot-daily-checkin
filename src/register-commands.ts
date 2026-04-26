import { REST, Routes } from 'discord.js';
import { loadConfig } from './config';
import { rankoCommand } from './commands';

async function main(): Promise<void> {
    const config = loadConfig();

    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
        throw new Error('CLIENT_ID missing');
    }

    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    await rest.put(Routes.applicationGuildCommands(clientId, config.guildId), {
        body: [rankoCommand.toJSON()],
    });

    console.log('Commands registered');
}

main();
