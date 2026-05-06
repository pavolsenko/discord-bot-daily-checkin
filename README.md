# Discord daily check bot

A TypeScript Discord bot that checks once per day whether every eligible member posted in a target channel, assigns a role to members who did not, and stores statistics in MySQL.

## What it does

- Runs every day at 09:00 in the configured timezone.
- Fetches recent messages from one Discord channel.
- Detects which users posted.
- Assigns a role to users who missed the check.
- Removes that role from users who posted.
- Stores per-user miss counts in MySQL.

## Requirements

- Node.js 20+
- A Discord bot application
- A MySQL database
- The bot must have permission to read the channel and manage the badge role.

## Discord setup

Enable these gateway intents in the Discord Developer Portal:

- Guilds
- Guild Members
- Guild Messages

The bot does not need Message Content intent for this workflow because it only needs message authors and timestamps.

The badge role must be below the bot's highest role in the server role list.

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in the values.

## Run

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Manual one-time check:

```bash
npm run check:now
```

