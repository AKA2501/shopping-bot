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

function buildEvent(eventType, previousRow, currentProduct, runId) {
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
    metadata: {
      category: currentProduct.category,
      currency: currentProduct.currency
    }
  };
}

export function compareStock(previousRows, currentProducts, runId, observedAt) {
  const previousBySku = new Map(previousRows.map((row) => [row.sku, normalizeCachedRow(row)]));
  const events = [];
  const cacheRows = [];

  for (const product of currentProducts) {
    const previousRow = previousBySku.get(product.sku);
    let changed = false;

    if (!previousRow) {
      events.push(buildEvent('new_product', null, product, runId));
      changed = true;
    } else {
      if (!previousRow.in_stock && product.inStock) {
        events.push(buildEvent('restock', previousRow, product, runId));
        changed = true;
      }

      if (Number(previousRow.quantity) !== Number(product.quantity)) {
        events.push(buildEvent('quantity_change', previousRow, product, runId));
        changed = true;
      }

      if (roundPrice(previousRow.price) !== roundPrice(product.price)) {
        events.push(buildEvent('price_change', previousRow, product, runId));
        changed = true;
      }
    }

    cacheRows.push({
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
    });
  }

  return {
    events,
    cacheRows
  };
}

