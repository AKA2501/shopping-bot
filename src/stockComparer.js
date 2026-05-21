function roundPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(2));
}

function normalizeCachedRow(row) {
  return {
    ...row,
    price: roundPrice(row.price),
    quantity: Number(row.quantity ?? 0),
    in_stock: Boolean(row.in_stock)
  };
}

export function buildCacheKey(target, sku) {
  return `${target.category}:${target.pincode}:${sku}`;
}

function buildAlertEvent(eventType, previousRow, currentProduct, target, runId) {
  return {
    runId,
    sku: currentProduct.sku,
    eventType,
    productName: currentProduct.name,
    previousInStock: previousRow ? Boolean(previousRow.in_stock) : null,
    currentInStock: currentProduct.inStock,
    previousQuantity: previousRow ? Number(previousRow.quantity ?? 0) : null,
    currentQuantity: currentProduct.quantity,
    previousPrice: previousRow ? roundPrice(previousRow.price) : null,
    currentPrice: currentProduct.price,
    productUrl: currentProduct.productUrl,
    pincode: target.pincode,
    metadata: {
      category: currentProduct.category,
      currency: currentProduct.currency,
      pincode: target.pincode
    }
  };
}

function crossedIntoLowStock(previousRow, currentProduct, lowStockThreshold) {
  if (!currentProduct.inStock || currentProduct.quantity >= lowStockThreshold) {
    return false;
  }

  if (!previousRow) {
    return true;
  }

  if (!previousRow.in_stock) {
    return false;
  }

  return Number(previousRow.quantity ?? 0) >= lowStockThreshold;
}

function buildCacheRow(target, product, observedAt, changed, previousRow) {
  return {
    cache_key: buildCacheKey(target, product.sku),
    pincode: target.pincode,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    product_url: product.productUrl,
    image_url: product.imageUrl,
    currency: product.currency,
    price: product.price,
    in_stock: product.inStock,
    quantity: product.quantity,
    metadata: product.metadata,
    last_seen_at: observedAt,
    last_changed_at: changed ? observedAt : previousRow?.last_changed_at ?? observedAt
  };
}

export function compareStock(previousRows, currentProducts, target, runId, observedAt, options = {}) {
  const lowStockThreshold = Number(options.lowStockThreshold ?? 10);
  const previousBySku = new Map(previousRows.map((row) => [row.sku, normalizeCachedRow(row)]));
  const alertEvents = [];
  const cacheRows = [];
  const isInitialSnapshot = previousRows.length === 0;

  for (const product of currentProducts) {
    const previousRow = previousBySku.get(product.sku);
    let changed = false;

    if (previousRow) {
      changed =
        Boolean(previousRow.in_stock) !== Boolean(product.inStock) ||
        Number(previousRow.quantity) !== Number(product.quantity) ||
        roundPrice(previousRow.price) !== roundPrice(product.price);
    } else {
      changed = true;
    }

    if (!isInitialSnapshot) {
      if (previousRow && !previousRow.in_stock && product.inStock) {
        alertEvents.push(buildAlertEvent('restock', previousRow, product, target, runId));
      } else if (previousRow && previousRow.in_stock && !product.inStock) {
        alertEvents.push(buildAlertEvent('out_of_stock', previousRow, product, target, runId));
      } else if (crossedIntoLowStock(previousRow, product, lowStockThreshold)) {
        alertEvents.push(buildAlertEvent('low_stock', previousRow, product, target, runId));
      }
    }

    cacheRows.push(buildCacheRow(target, product, observedAt, changed, previousRow));
  }

  return {
    alertEvents,
    cacheRows,
    isInitialSnapshot
  };
}
