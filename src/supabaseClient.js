import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const REQUIRED_TABLES = [
  'product_stock_cache',
  'stock_events',
  'email_commands',
  'order_intents'
];

function assertNoError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

class UnsupportedRealtimeTransport {
  constructor() {
    throw new Error(
      'Realtime transport is unavailable in this runtime. This stock bot does not use Supabase Realtime.'
    );
  }
}

function resolveRealtimeTransport() {
  return globalThis.WebSocket ?? UnsupportedRealtimeTransport;
}

export function getSupabaseClient(config) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    realtime: {
      transport: resolveRealtimeTransport()
    }
  });
}

export async function loadCachedProductsBySkus(supabase, skus) {
  if (!skus.length) {
    return [];
  }

  const { data, error } = await supabase.from('product_stock_cache').select('*').in('sku', skus);
  assertNoError(error, 'Failed to load product_stock_cache rows');
  return data ?? [];
}

export async function insertStockEvents(supabase, events) {
  if (!events.length) {
    return [];
  }

  const rows = events.map((event) => ({
    run_id: event.runId,
    sku: event.sku,
    event_type: event.eventType,
    product_name: event.productName,
    previous_in_stock: event.previousInStock,
    current_in_stock: event.currentInStock,
    previous_quantity: event.previousQuantity,
    current_quantity: event.currentQuantity,
    previous_price: event.previousPrice,
    current_price: event.currentPrice,
    product_url: event.productUrl,
    metadata: event.metadata
  }));

  let response = await supabase.from('stock_events').insert(rows).select();
  if (!response.error) {
    return response.data ?? [];
  }

  if (String(response.error.message).includes('event_hash')) {
    response = await supabase
      .from('stock_events')
      .insert(
        rows.map((row) => ({
          ...row,
          event_hash: createHash('sha256')
            .update(JSON.stringify(row))
            .digest('hex')
        }))
      )
      .select();

    if (!response.error) {
      return response.data ?? [];
    }
  }

  assertNoError(response.error, 'Failed to insert stock_events');
  return response.data ?? [];
}

export async function upsertProductCache(supabase, cacheRows) {
  if (!cacheRows.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('product_stock_cache')
    .upsert(cacheRows, { onConflict: 'sku' })
    .select();

  assertNoError(error, 'Failed to upsert product_stock_cache');
  return data ?? [];
}

export async function getExistingEmailCommand(supabase, messageId) {
  const { data, error } = await supabase
    .from('email_commands')
    .select('*')
    .eq('message_id', messageId)
    .maybeSingle();

  assertNoError(error, 'Failed to load email command');
  return data;
}

export async function insertEmailCommand(supabase, row) {
  let response = await supabase.from('email_commands').insert(row).select().single();
  if (!response.error) {
    return response.data;
  }

  if (String(response.error.message).includes('source_message_id')) {
    response = await supabase
      .from('email_commands')
      .insert({
        ...row,
        source_message_id: row.message_id
      })
      .select()
      .single();

    if (!response.error) {
      return response.data;
    }
  }

  if (String(response.error.message).includes('from_email')) {
    response = await supabase
      .from('email_commands')
      .insert({
        ...row,
        source_message_id: row.message_id,
        from_email: row.sender_email
      })
      .select()
      .single();

    if (!response.error) {
      return response.data;
    }
  }

  if (String(response.error.message).includes('from_name')) {
    response = await supabase
      .from('email_commands')
      .insert({
        ...row,
        source_message_id: row.message_id,
        from_email: row.sender_email
      })
      .select()
      .single();
  }

  assertNoError(response.error, 'Failed to insert email command');
  return response.data;
}

export async function updateEmailCommand(supabase, id, row) {
  const { data, error } = await supabase.from('email_commands').update(row).eq('id', id).select().single();
  assertNoError(error, 'Failed to update email command');
  return data;
}

export async function getProductBySku(supabase, sku) {
  const { data, error } = await supabase
    .from('product_stock_cache')
    .select('*')
    .eq('sku', sku)
    .maybeSingle();

  assertNoError(error, 'Failed to load product by SKU');
  return data;
}

export async function listInStockProducts(supabase, category, limit = 25) {
  const { data, error } = await supabase
    .from('product_stock_cache')
    .select('*')
    .eq('category', category)
    .eq('in_stock', true)
    .gt('quantity', 0)
    .order('quantity', { ascending: false })
    .limit(limit);

  assertNoError(error, 'Failed to list in-stock products');
  return data ?? [];
}

export async function insertOrderIntent(supabase, row) {
  const { data, error } = await supabase.from('order_intents').insert(row).select().single();
  assertNoError(error, 'Failed to insert order intent');
  return data;
}

export async function verifyTables(supabase, tableNames = REQUIRED_TABLES) {
  const results = [];

  for (const tableName of tableNames) {
    const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    results.push({
      tableName,
      ok: !error,
      count: error ? null : count,
      error: error?.message ?? null
    });
  }

  return results;
}
