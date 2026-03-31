import 'dotenv/config';
import { z } from 'zod';

function splitCsvIds(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  GUILD_ID: z.string().min(1),
  CHANNEL_ID: z.string().min(1),
  BADGE_ROLE_ID: z.string().min(1),
  TIMEZONE: z.string().min(1).default('Europe/Vienna'),
  CHECK_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  CHECK_MINUTE: z.coerce.number().int().min(0).max(59).default(0),
  EXCLUDED_ROLE_IDS: z.string().optional(),
  REPORT_CHANNEL_ID: z.string().optional(),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DATABASE: z.string().min(1),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
});

export type AppConfig = {
  discordToken: string;
  guildId: string;
  channelId: string;
  badgeRoleId: string;
  timezone: string;
  checkHour: number;
  checkMinute: number;
  excludedRoleIds: string[];
  reportChannelId?: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit: number;
  };
};

export function loadConfig(): AppConfig {
  const env = envSchema.parse(process.env);

  return {
    discordToken: env.DISCORD_TOKEN,
    guildId: env.GUILD_ID,
    channelId: env.CHANNEL_ID,
    badgeRoleId: env.BADGE_ROLE_ID,
    timezone: 'Europe/Vienna',
    checkHour: 9,
    checkMinute: 0,
    excludedRoleIds: splitCsvIds(env.EXCLUDED_ROLE_IDS),
    reportChannelId: env.REPORT_CHANNEL_ID?.trim() || undefined,
    database: {
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    },
  };
}
