import nodemailer from 'nodemailer';

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price, currency = 'INR') {
  if (price == null) {
    return 'N/A';
  }

  return `${price} ${currency}`;
}

function getDisplayName(item) {
  return item.productName ?? item.name ?? item.sku;
}

function sortProducts(products) {
  return [...products].sort((left, right) => getDisplayName(left).localeCompare(getDisplayName(right)));
}

function buildAlertBuckets(alertEvents) {
  return {
    restocked: sortProducts(alertEvents.filter((event) => event.eventType === 'restock')),
    outOfStock: sortProducts(alertEvents.filter((event) => event.eventType === 'out_of_stock')),
    lowStock: sortProducts(alertEvents.filter((event) => event.eventType === 'low_stock'))
  };
}

function buildSnapshotBuckets(products) {
  return {
    inStock: sortProducts(products.filter((product) => product.inStock)),
    outOfStock: sortProducts(products.filter((product) => !product.inStock))
  };
}

function buildSubject(target, notification) {
  if (notification.type === 'snapshot') {
    return `[Shopping Bot] Stock snapshot for ${target.category} / ${target.pincode}`;
  }

  const counts = [];
  if (notification.buckets.restocked.length) {
    counts.push(`${notification.buckets.restocked.length} back in stock`);
  }
  if (notification.buckets.outOfStock.length) {
    counts.push(`${notification.buckets.outOfStock.length} out of stock`);
  }
  if (notification.buckets.lowStock.length) {
    counts.push(`${notification.buckets.lowStock.length} low stock`);
  }

  return `[Shopping Bot] ${target.category} / ${target.pincode}: ${counts.join(', ')}`;
}

function renderQuantityBadge(quantity, lowStockThreshold, isInStock) {
  const isLowStock = isInStock && quantity < lowStockThreshold;
  const style = isLowStock
    ? 'color:#b42318;font-weight:700;'
    : 'color:#111827;font-weight:600;';

  return `<span style="${style}">${escapeHtml(quantity)}</span>`;
}

function buildProductLine(product, lowStockThreshold) {
  const quantity = product.currentQuantity ?? product.quantity ?? 0;
  const price = product.currentPrice ?? product.price ?? null;
  const currency = product.metadata?.currency ?? product.currency ?? 'INR';
  const inStock = product.currentInStock ?? product.inStock ?? false;
  const label = inStock ? 'In stock' : 'Out of stock';
  const url = product.productUrl ?? product.product_url ?? null;

  return [
    `${product.productName ?? product.name} (${product.sku})`,
    `Qty: ${quantity}${inStock && quantity < lowStockThreshold ? ' [LOW]' : ''}`,
    `Price: ${formatPrice(price, currency)}`,
    `Status: ${label}`,
    url ? `Link: ${url}` : null
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSectionText(title, items, lowStockThreshold) {
  const lines = [title];
  for (const item of items) {
    lines.push('');
    lines.push(buildProductLine(item, lowStockThreshold));
  }
  return lines.join('\n');
}

function buildGroupedStockEmailText(config, notification) {
  const target = notification.target;
  const lines = [
    notification.type === 'snapshot'
      ? `Fresh stock snapshot for category "${target.category}" in pincode ${target.pincode}.`
      : `Stock update for category "${target.category}" in pincode ${target.pincode}.`,
    `Run ID: ${notification.runId}`,
    ''
  ];

  if (notification.type === 'snapshot') {
    const { inStock, outOfStock } = notification.buckets;
    if (inStock.length) {
      lines.push(buildSectionText('In Stock', inStock, config.lowStockThreshold));
      lines.push('');
    }
    if (outOfStock.length) {
      lines.push(buildSectionText('Out of Stock', outOfStock, config.lowStockThreshold));
      lines.push('');
    }
  } else {
    const sections = [
      ['Back In Stock', notification.buckets.restocked],
      ['Now Out Of Stock', notification.buckets.outOfStock],
      ['Low Stock', notification.buckets.lowStock]
    ];

    for (const [title, items] of sections) {
      if (!items.length) {
        continue;
      }

      lines.push(buildSectionText(title, items, config.lowStockThreshold));
      lines.push('');
    }
  }

  lines.push('Reply commands:');
  lines.push('BUY <SKU> <QTY>');
  lines.push('STATUS <SKU>');
  lines.push('LIST IN_STOCK');
  lines.push('HELP');
  lines.push('');
  lines.push(
    'Manual checkout only. No auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage is performed.'
  );

  return lines.join('\n');
}

function renderProductCard(item, lowStockThreshold) {
  const name = escapeHtml(item.productName ?? item.name);
  const sku = escapeHtml(item.sku);
  const quantity = item.currentQuantity ?? item.quantity ?? 0;
  const price = item.currentPrice ?? item.price ?? null;
  const currency = item.metadata?.currency ?? item.currency ?? 'INR';
  const inStock = item.currentInStock ?? item.inStock ?? false;
  const url = item.productUrl ?? item.product_url ?? null;

  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:15px;font-weight:700;color:#111827;">${name}</div>
        <div style="margin-top:4px;font-size:12px;color:#6b7280;">SKU: ${sku}</div>
        <div style="margin-top:10px;font-size:13px;color:#374151;">
          <span style="margin-right:14px;">Qty: ${renderQuantityBadge(
            quantity,
            lowStockThreshold,
            inStock
          )}</span>
          <span style="margin-right:14px;">Price: <strong>${escapeHtml(
            formatPrice(price, currency)
          )}</strong></span>
          <span>Status: <strong style="color:${inStock ? '#027a48' : '#b42318'};">${escapeHtml(
            inStock ? 'In stock' : 'Out of stock'
          )}</strong></span>
        </div>
        ${
          url
            ? `<div style="margin-top:10px;"><a href="${escapeHtml(url)}" style="color:#175cd3;text-decoration:none;">Open product</a></div>`
            : ''
        }
      </td>
    </tr>
  `;
}

function renderSectionHtml(title, items, lowStockThreshold) {
  if (!items.length) {
    return '';
  }

  return `
    <div style="margin-top:28px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(title)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${items.map((item) => renderProductCard(item, lowStockThreshold)).join('')}
      </table>
    </div>
  `;
}

function buildGroupedStockEmailHtml(config, notification) {
  const target = notification.target;
  const intro =
    notification.type === 'snapshot'
      ? 'Fresh stock snapshot after an empty cache or reset.'
      : 'Important stock state changes only. Quantity-only swings are intentionally suppressed.';

  const sections =
    notification.type === 'snapshot'
      ? [
          ['In Stock', notification.buckets.inStock],
          ['Out Of Stock', notification.buckets.outOfStock]
        ]
      : [
          ['Back In Stock', notification.buckets.restocked],
          ['Now Out Of Stock', notification.buckets.outOfStock],
          ['Low Stock (<10)', notification.buckets.lowStock]
        ];

  return `
    <html>
      <body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:28px 32px;">
          <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef4ff;color:#175cd3;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
            Shopping Bot
          </div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.2;color:#111827;">
            ${notification.type === 'snapshot' ? 'Stock Snapshot' : 'Stock Update'}
          </h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#475467;">
            ${escapeHtml(intro)}
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#667085;">
            Category: <strong>${escapeHtml(target.category)}</strong><br>
            Pincode: <strong>${escapeHtml(target.pincode)}</strong><br>
            Run ID: <code style="font-size:12px;">${escapeHtml(notification.runId)}</code>
          </p>
          ${sections
            .map(([title, items]) => renderSectionHtml(title, items, config.lowStockThreshold))
            .join('')}
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:700;color:#111827;">Reply commands</div>
            <div style="margin-top:10px;font-size:13px;line-height:1.8;color:#475467;">
              <div><code>BUY &lt;SKU&gt; &lt;QTY&gt;</code></div>
              <div><code>STATUS &lt;SKU&gt;</code></div>
              <div><code>LIST IN_STOCK</code></div>
              <div><code>HELP</code></div>
            </div>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#667085;">
              Manual checkout only. No auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage is performed.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildNotificationPayload(config, target, runId, alertEvents, currentProducts, isInitialSnapshot) {
  if (isInitialSnapshot) {
    return {
      type: 'snapshot',
      target,
      runId,
      buckets: buildSnapshotBuckets(currentProducts)
    };
  }

  const buckets = buildAlertBuckets(alertEvents);
  const hasAlertableChanges = buckets.restocked.length || buckets.outOfStock.length || buckets.lowStock.length;
  if (!hasAlertableChanges) {
    return null;
  }

  return {
    type: 'alerts',
    target,
    runId,
    buckets
  };
}

export async function sendGroupedStockEmail(
  config,
  logger,
  target,
  alertEvents,
  currentProducts,
  runId,
  isInitialSnapshot = false
) {
  const notification = buildNotificationPayload(
    config,
    target,
    runId,
    alertEvents,
    currentProducts,
    isInitialSnapshot
  );

  if (!notification) {
    return null;
  }

  const subject = buildSubject(target, notification);
  const text = buildGroupedStockEmailText(config, notification);
  const html = buildGroupedStockEmailHtml(config, notification);

  if (config.dryRun) {
    logger.info('Dry run: grouped stock email skipped', {
      subject,
      recipients: target.recipients,
      body: text
    });
    return { skipped: true, subject, text, html };
  }

  const transport = createTransport(config);
  const info = await transport.sendMail({
    from: config.emailFrom,
    to: target.recipients.join(', '),
    subject,
    text,
    html
  });

  logger.info('Grouped stock email sent', {
    messageId: info.messageId,
    recipients: target.recipients,
    target: target.key,
    type: notification.type
  });
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
