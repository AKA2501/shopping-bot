import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function buildFallbackMessageId(parsed, uid) {
  const datePart = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();
  return `imap-${uid}-${datePart}`;
}

export async function fetchRecentReplyEmails(config, logger) {
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
    const since = new Date(Date.now() - config.replyLookbackHours * 60 * 60 * 1000);
    const uids = await client.search({ since });
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
  } finally {
    lock?.release();
    await client.logout().catch(() => {
      client.close();
    });
  }
}
