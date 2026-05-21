function productSnapshot(product) {
  if (!product) {
    return 'Product not found in the current cache.';
  }

  return [
    product.pincode ? `Pincode: ${product.pincode}` : null,
    `SKU: ${product.sku}`,
    `Name: ${product.name}`,
    `Stock: ${product.in_stock ? 'IN STOCK' : 'OUT OF STOCK'}`,
    `Quantity: ${product.quantity ?? 0}`,
    `Price: ${product.price ?? 'N/A'} ${product.currency ?? 'INR'}`,
    product.product_url ? `Link: ${product.product_url}` : null
  ]
    .filter(Boolean)
    .join('\n');
}

function commandFooter() {
  return [
    '',
    'Supported commands:',
    'BUY <SKU> <QTY>',
    'STATUS <SKU>',
    'LIST IN_STOCK',
    'HELP',
    '',
    'Manual checkout only. No auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage is performed.'
  ].join('\n');
}

export function buildHelpReply() {
  return {
    subject: 'Shopping Bot Help',
    text: [
      'Available commands:',
      'BUY <SKU> <QTY>  - create a manual-checkout order intent',
      'STATUS <SKU>     - view the latest cached stock status',
      'LIST IN_STOCK    - list currently in-stock products',
      'HELP             - show this help message',
      commandFooter()
    ].join('\n')
  };
}

export function buildUnknownCommandReply() {
  return {
    subject: 'Shopping Bot Command Not Recognized',
    text: [
      'The bot could not recognize your command.',
      'Reply with HELP to see the supported command format.',
      commandFooter()
    ].join('\n')
  };
}

export function buildUnauthorizedReply(senderEmail) {
  return {
    subject: 'Shopping Bot Access Denied',
    text: [
      `The sender ${senderEmail} is not authorized to issue bot commands.`,
      'Only addresses listed in EMAIL_TO are allowed to submit commands.',
      commandFooter()
    ].join('\n')
  };
}

export function buildStatusReply(product, sku) {
  const snapshots = Array.isArray(product)
    ? product.length
      ? product.map((entry) => productSnapshot(entry)).join('\n\n---\n\n')
      : `No cached product was found for SKU ${sku}.`
    : productSnapshot(product);

  return {
    subject: `Stock Status ${sku}`,
    text: [snapshots, commandFooter()].join('\n\n')
  };
}

export function buildListReply(groupedProducts, category) {
  const lines = [];

  for (const entry of groupedProducts) {
    if (!entry.products.length) {
      continue;
    }

    lines.push(`Pincode ${entry.target.pincode}:`);
    lines.push(
      ...entry.products.map(
        (product) =>
          `- ${product.sku} | ${product.name} | qty ${product.quantity} | price ${product.price ?? 'N/A'} ${product.currency ?? 'INR'}${product.product_url ? ` | ${product.product_url}` : ''}`
      )
    );
    lines.push('');
  }

  if (!lines.length) {
    lines.push('No in-stock products were found in the cache.');
  }

  return {
    subject: `In-Stock Products for ${category}`,
    text: [`Current in-stock products for ${category}:`, ...lines, commandFooter()].join('\n')
  };
}

export function buildBuyReply(product, intent, quantity) {
  const lines = [
    `Order intent recorded: ${intent.id}`,
    `Requested quantity: ${quantity}`,
    `Mode: manual checkout only`,
    `Intent status: ${intent.status}`,
    intent.pincode ? `Pincode: ${intent.pincode}` : null
  ];

  if (product) {
    lines.push(productSnapshot(product));
  } else {
    lines.push('The SKU was not found in the latest cache. The intent has been saved for manual review.');
  }

  lines.push(commandFooter());

  return {
    subject: `Order Intent ${intent.id}`,
    text: lines.join('\n\n')
  };
}
