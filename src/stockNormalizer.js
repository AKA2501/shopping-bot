function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function collectCandidateValues(input, candidateKeys, values = [], depth = 0) {
  if (input == null || depth > 4) {
    return values;
  }

  const normalizedCandidates = new Set(candidateKeys.map(normalizeKey));

  if (Array.isArray(input)) {
    for (const item of input) {
      collectCandidateValues(item, candidateKeys, values, depth + 1);
    }
    return values;
  }

  if (!isObject(input)) {
    return values;
  }

  for (const [key, value] of Object.entries(input)) {
    if (normalizedCandidates.has(normalizeKey(key))) {
      values.push(value);
    }

    if (isObject(value) || Array.isArray(value)) {
      collectCandidateValues(value, candidateKeys, values, depth + 1);
    }
  }

  return values;
}

function pickString(input, candidateKeys) {
  for (const value of collectCandidateValues(input, candidateKeys)) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function pickNumber(input, candidateKeys) {
  for (const value of collectCandidateValues(input, candidateKeys)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      if (!cleaned) {
        continue;
      }

      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function pickBoolean(input, candidateKeys) {
  for (const value of collectCandidateValues(input, candidateKeys)) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value > 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'in stock', 'available', 'available_for_sale'].includes(normalized)) {
        return true;
      }
      if (['false', 'no', 'out of stock', 'unavailable', 'sold out'].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function toAbsoluteUrl(baseUrl, pathValue) {
  if (!pathValue) {
    return null;
  }

  try {
    return new URL(pathValue, baseUrl).toString();
  } catch {
    return pathValue;
  }
}

function roundPrice(value) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(2));
}

function normalizeSku(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
}

function sanitizeMetadata(raw) {
  const metadata = {
    source_id: pickString(raw, ['id', 'product_id', 'variant_id']),
    source_status: pickString(raw, ['status', 'availability', 'inventory_status']),
    source_slug: pickString(raw, ['slug', 'handle']),
    source_currency: pickString(raw, ['currency', 'currency_code'])
  };

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value != null));
}

function mergeProduct(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  if (incoming.inStock && !existing.inStock) {
    return incoming;
  }

  if (incoming.quantity > existing.quantity) {
    return incoming;
  }

  return existing;
}

export function normalizeProducts(rawProducts, config, logger) {
  const bySku = new Map();

  for (const raw of rawProducts) {
    const sku = normalizeSku(
      pickString(raw, ['sku', 'product_sku', 'variant_sku', 'item_code', 'product_code', 'code', 'id'])
    );

    if (!sku) {
      logger.warn('Skipping product without SKU');
      continue;
    }

    const quantity = Math.max(
      0,
      Math.trunc(
        pickNumber(raw, [
          'quantity',
          'qty',
          'stock',
          'inventory',
          'inventory_quantity',
          'available_quantity',
          'available_stock'
        ]) ?? 0
      )
    );

    const explicitInStock = pickBoolean(raw, [
      'in_stock',
      'is_in_stock',
      'available',
      'availability',
      'status'
    ]);
    const inStock = explicitInStock ?? quantity > 0;

    const product = {
      sku,
      name:
        pickString(raw, ['name', 'title', 'product_name', 'display_name']) ??
        `Product ${sku}`,
      brand: pickString(raw, ['brand', 'vendor', 'manufacturer']),
      category: pickString(raw, ['category', 'collection', 'type']) ?? config.productCategory,
      productUrl: toAbsoluteUrl(
        config.productUrlBase,
        pickString(raw, ['product_url', 'url', 'link', 'slug', 'handle', 'alias'])
      ),
      imageUrl: toAbsoluteUrl(
        config.productUrlBase,
        pickString(raw, ['image_url', 'image', 'thumbnail', 'thumbnail_url'])
      ),
      currency: pickString(raw, ['currency', 'currency_code']) ?? 'INR',
      price: roundPrice(
        pickNumber(raw, ['price', 'sale_price', 'final_price', 'offer_price', 'mrp'])
      ),
      inStock,
      quantity,
      metadata: sanitizeMetadata(raw)
    };

    bySku.set(product.sku, mergeProduct(bySku.get(product.sku), product));
  }

  const normalizedProducts = Array.from(bySku.values()).sort((left, right) => left.name.localeCompare(right.name));
  logger.info('Normalized products', { count: normalizedProducts.length });
  return normalizedProducts;
}
