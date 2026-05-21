import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function buildFallbackMessageId(parsed, uid) {
  const datePart = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();
  return `imap-${uid}-${datePart}`;
}

async function withImapClient(config, logger, callback) {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: {
      user: config.imapUser,
      pass: config.imapPass
    }
  });

  client.on('error', (error) => {
    logger.warn('IMAP client error', {
      error: {
        name: error.name,
        message: error.message
      }
    });
  });

  let lock;

  try {
    await client.connect();
    lock = await client.getMailboxLock(config.imapMailbox);
    return await callback(client);
  } finally {
    lock?.release();
    await client.logout().catch(() => {
      client.close();
    });
  }
}

export async function fetchRecentReplyEmails(config, logger) {
  return withImapClient(config, logger, async (client) => {
    const since = new Date(Date.now() - config.replyLookbackHours * 60 * 60 * 1000);
    const uids = await client.search({
      since,
      seen: false
    });
    const recentUids = uids.slice(-100);
    const messages = [];

    for await (const message of client.fetch(recentUids, { uid: true, source: true, envelope: true })) {
      const parsed = await simpleParser(message.source);
      const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() ?? null;

      if (!fromAddress || fromAddress === config.smtpUser.toLowerCase()) {
        continue;
      }

      messages.push({
        uid: message.uid,
        messageId: parsed.messageId ?? buildFallbackMessageId(parsed, message.uid),
        inReplyTo: parsed.inReplyTo ?? null,
        fromAddress,
        fromName: parsed.from?.value?.[0]?.name ?? null,
        subject: parsed.subject ?? '',
        text: parsed.text ?? '',
        receivedAt: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString()
      });
    }

    messages.sort((left, right) => new Date(left.receivedAt) - new Date(right.receivedAt));
    logger.info('Fetched reply emails', { count: messages.length, scannedMessages: recentUids.length });
    return messages;
  });
}

export async function markReplyEmailsSeen(config, logger, uids) {
  const uniqueUids = [...new Set((uids ?? []).filter((uid) => Number.isInteger(uid) && uid > 0))];
  if (!uniqueUids.length) {
    return;
  }

  await withImapClient(config, logger, async (client) => {
    await client.messageFlagsAdd(uniqueUids, ['\\Seen'], { uid: true });
    logger.info('Marked reply emails as seen', { count: uniqueUids.length });
  });
}
