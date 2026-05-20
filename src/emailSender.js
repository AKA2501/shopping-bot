import nodemailer from 'nodemailer';

function buildEventLine(event) {
  const parts = [`${event.eventType}`, `${event.productName} (${event.sku})`];

  if (event.currentPrice != null) {
    parts.push(`price ${event.currentPrice}`);
  }

  parts.push(`qty ${event.currentQuantity}`);
  parts.push(event.currentInStock ? 'IN STOCK' : 'OUT OF STOCK');

  if (event.productUrl) {
    parts.push(event.productUrl);
  }

  return `- ${parts.join(' | ')}`;
}

function buildGroupedStockEmailBody(config, events, runId) {
  const grouped = new Map();
  for (const event of events) {
    if (!grouped.has(event.sku)) {
      grouped.set(event.sku, []);
    }
    grouped.get(event.sku).push(event);
  }

  const lines = [
    `Stock changes detected for category "${config.productCategory}" in pincode ${config.pincode}.`,
    `Run ID: ${runId}`,
    '',
    'Changes:'
  ];

  for (const productEvents of grouped.values()) {
    for (const event of productEvents) {
      lines.push(buildEventLine(event));
    }
  }

  lines.push('');
  lines.push('Reply commands:');
  lines.push('BUY <SKU> <QTY>');
  lines.push('STATUS <SKU>');
  lines.push('LIST IN_STOCK');
  lines.push('HELP');
  lines.push('');
  lines.push('Manual checkout only. No auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage is performed.');

  return lines.join('\n');
}

function createTransport(config) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });
}

export async function sendGroupedStockEmail(config, logger, events, runId) {
  if (!events.length) {
    return null;
  }

  const subject = `[Shopping Bot] ${events.length} stock change(s) for ${config.productCategory}`;
  const text = buildGroupedStockEmailBody(config, events, runId);

  if (config.dryRun) {
    logger.info('Dry run: grouped stock email skipped', {
      subject,
      recipients: config.emailRecipients,
      body: text
    });
    return { skipped: true, subject, text };
  }

  const transport = createTransport(config);
  const info = await transport.sendMail({
    from: config.emailFrom,
    to: config.emailRecipients.join(', '),
    subject,
    text
  });

  logger.info('Grouped stock email sent', { messageId: info.messageId });
  return info;
}

export async function sendReplyEmail(config, logger, message) {
  if (config.dryRun) {
    logger.info('Dry run: reply email skipped', message);
    return { skipped: true };
  }

  const transport = createTransport(config);
  const info = await transport.sendMail({
    from: config.emailFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    inReplyTo: message.inReplyTo,
    references: message.inReplyTo ? [message.inReplyTo] : undefined
  });

  logger.info('Reply email sent', { to: message.to, messageId: info.messageId });
  return info;
}

