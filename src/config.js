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
  EMAIL_TO: z.string().optional(),
  PRODUCT_CATEGORY: z.string().min(1),
  PRODUCT_URL_BASE: z.string().min(1),
  PINCODE: z.string().optional(),
  RECIPIENT_TARGETS: z.string().optional(),
  DRY_RUN: z.string().optional(),
  REPLY_LOOKBACK_HOURS: z.coerce.number().int().positive().default(72),
  IMAP_MAILBOX: z.string().default('INBOX'),
  PRODUCT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().positive().default(10),
  NODE_ENV: z.string().default('production'),
  GITHUB_RUN_ID: z.string().optional(),
  GITHUB_REPOSITORY: z.string().optional()
});

function splitList(value) {
  return String(value)
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

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return splitList(value);
  }

  return [];
}

function buildTargetKey(category, pincode) {
  return `${category}:${pincode}`;
}

function normalizeTargetEntry(rawTarget, productCategory) {
  const pincode = String(rawTarget?.pincode ?? '').trim();
  const recipients = normalizeRecipients(
    rawTarget?.recipients ?? rawTarget?.emails ?? rawTarget?.email_to ?? rawTarget?.email
  );

  if (!pincode) {
    throw new Error('Each RECIPIENT_TARGETS entry must include a pincode.');
  }

  if (!recipients.length) {
    throw new Error(`Target for pincode ${pincode} must include at least one recipient.`);
  }

  const category = String(rawTarget?.category ?? productCategory).trim() || productCategory;
  return {
    key: buildTargetKey(category, pincode),
    category,
    pincode,
    recipients: [...new Set(recipients)],
    label: String(rawTarget?.label ?? `${category} ${pincode}`).trim()
  };
}

function parseWatchTargets(env) {
  if (env.RECIPIENT_TARGETS?.trim()) {
    let parsedTargets;

    try {
      parsedTargets = JSON.parse(env.RECIPIENT_TARGETS);
    } catch (error) {
      throw new Error(`RECIPIENT_TARGETS must be valid JSON: ${error.message}`);
    }

    if (!Array.isArray(parsedTargets) || !parsedTargets.length) {
      throw new Error('RECIPIENT_TARGETS must be a non-empty JSON array.');
    }

    return parsedTargets.map((entry) => normalizeTargetEntry(entry, env.PRODUCT_CATEGORY));
  }

  if (!env.EMAIL_TO?.trim() || !env.PINCODE?.trim()) {
    throw new Error(
      'Provide either RECIPIENT_TARGETS or the legacy EMAIL_TO + PINCODE values.'
    );
  }

  return [
    normalizeTargetEntry(
      {
        pincode: env.PINCODE,
        recipients: env.EMAIL_TO
      },
      env.PRODUCT_CATEGORY
    )
  ];
}

export function getReplyTargetsForSender(config, senderEmail) {
  const normalizedSender = String(senderEmail || '').trim().toLowerCase();
  return config.watchTargets.filter((target) => target.recipients.includes(normalizedSender));
}

export function getPrimaryReplyTarget(config, senderEmail) {
  return getReplyTargetsForSender(config, senderEmail)[0] ?? null;
}

export function loadConfig(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = envSchema.parse(process.env);

  const dryRunFromArg = argv.includes('--dry-run');
  const skipReplies = argv.includes('--skip-replies');
  const dryRun = dryRunFromArg || parseBoolean(env.DRY_RUN, false);
  const watchTargets = parseWatchTargets(env);
  const allowedReplySenders = [...new Set(watchTargets.flatMap((target) => target.recipients))];

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
    productCategory: env.PRODUCT_CATEGORY,
    productUrlBase: env.PRODUCT_URL_BASE,
    watchTargets,
    defaultTarget: watchTargets[0],
    emailRecipients: watchTargets[0]?.recipients ?? [],
    allowedReplySenders,
    dryRun,
    checkReplies: !skipReplies,
    replyLookbackHours: env.REPLY_LOOKBACK_HOURS,
    productRequestTimeoutMs: env.PRODUCT_REQUEST_TIMEOUT_MS,
    lowStockThreshold: env.LOW_STOCK_THRESHOLD,
    nodeEnv: env.NODE_ENV,
    workflowRunId: env.GITHUB_RUN_ID ?? null,
    repository: env.GITHUB_REPOSITORY ?? null,
    manualOrderMode: 'manual_checkout_only',
    listInStockLimit: 25
  };
}
