import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  BOT_SMTP_HOST: z.string().min(1),
  BOT_SMTP_PORT: z.coerce.number().int().positive(),
  BOT_SMTP_USER: z.string().min(1),
  BOT_SMTP_PASS: z.string().min(1),
  BOT_IMAP_HOST: z.string().min(1),
  BOT_IMAP_PORT: z.coerce.number().int().positive(),
  BOT_IMAP_USER: z.string().min(1),
  BOT_IMAP_PASS: z.string().min(1),
  EMAIL_TO: z.string().min(1),
  PRODUCT_CATEGORY: z.string().min(1),
  PRODUCT_URL_BASE: z.string().min(1),
  PINCODE: z.string().min(1),
  DRY_RUN: z.string().optional(),
  REPLY_LOOKBACK_HOURS: z.coerce.number().int().positive().default(72),
  IMAP_MAILBOX: z.string().default('INBOX'),
  PRODUCT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  NODE_ENV: z.string().default('production'),
  GITHUB_RUN_ID: z.string().optional(),
  GITHUB_REPOSITORY: z.string().optional()
});

function splitList(value) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function loadConfig(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = envSchema.parse(process.env);

  const dryRunFromArg = argv.includes('--dry-run');
  const skipReplies = argv.includes('--skip-replies');

  const emailRecipients = splitList(env.EMAIL_TO);
  const dryRun = dryRunFromArg || parseBoolean(env.DRY_RUN, false);

  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    smtpHost: env.BOT_SMTP_HOST,
    smtpPort: env.BOT_SMTP_PORT,
    smtpSecure: env.BOT_SMTP_PORT === 465,
    smtpUser: env.BOT_SMTP_USER,
    smtpPass: env.BOT_SMTP_PASS,
    emailFrom: env.BOT_SMTP_USER,
    imapHost: env.BOT_IMAP_HOST,
    imapPort: env.BOT_IMAP_PORT,
    imapSecure: env.BOT_IMAP_PORT === 993,
    imapUser: env.BOT_IMAP_USER,
    imapPass: env.BOT_IMAP_PASS,
    imapMailbox: env.IMAP_MAILBOX,
    emailRecipients,
    allowedReplySenders: emailRecipients,
    productCategory: env.PRODUCT_CATEGORY,
    productUrlBase: env.PRODUCT_URL_BASE,
    pincode: env.PINCODE,
    dryRun,
    checkReplies: !skipReplies,
    replyLookbackHours: env.REPLY_LOOKBACK_HOURS,
    productRequestTimeoutMs: env.PRODUCT_REQUEST_TIMEOUT_MS,
    nodeEnv: env.NODE_ENV,
    workflowRunId: env.GITHUB_RUN_ID ?? null,
    repository: env.GITHUB_REPOSITORY ?? null,
    manualOrderMode: 'manual_checkout_only',
    listInStockLimit: 25
  };
}

