import { v4 as uuidv4 } from 'uuid';
import { processReplyInbox } from './authorizedOrderService.js';
import { loadConfig } from './config.js';
import { sendGroupedStockEmail } from './emailSender.js';
import { createLogger } from './logger.js';
import { fetchProteinProducts } from './productApiClient.js';
import { compareStock } from './stockComparer.js';
import { normalizeProducts } from './stockNormalizer.js';
import {
  getSupabaseClient,
  insertStockEvents,
  loadCachedProductsBySkus,
  upsertProductCache
} from './supabaseClient.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const runId = uuidv4();
  const supabase = getSupabaseClient(config);
  const observedAt = new Date().toISOString();

  logger.info('Stock check started', {
    runId,
    dryRun: config.dryRun,
    checkReplies: config.checkReplies,
    repository: config.repository,
    workflowRunId: config.workflowRunId
  });

  const rawProducts = await fetchProteinProducts(config, logger);
  const normalizedProducts = normalizeProducts(rawProducts, config, logger);
  const previousRows = await loadCachedProductsBySkus(
    supabase,
    normalizedProducts.map((product) => product.sku)
  );

  const { events, cacheRows } = compareStock(previousRows, normalizedProducts, runId, observedAt);
  logger.info('Compared stock snapshot', {
    productCount: normalizedProducts.length,
    eventCount: events.length
  });

  if (config.dryRun) {
    logger.info('Dry run: skipping stock event inserts and cache updates', {
      eventCount: events.length,
      cacheRowCount: cacheRows.length
    });
  } else {
    await insertStockEvents(supabase, events);
    if (events.length) {
      await sendGroupedStockEmail(config, logger, events, runId);
    }
    await upsertProductCache(supabase, cacheRows);
  }

  if (config.dryRun && events.length) {
    await sendGroupedStockEmail(config, logger, events, runId);
  }

  if (config.checkReplies) {
    try {
      await processReplyInbox(config, supabase, logger);
    } catch (error) {
      logger.warn('Reply inbox processing failed', {
        error: {
          name: error.name,
          message: error.message
        }
      });
    }
  }

  logger.info('Stock check finished', {
    runId,
    productCount: normalizedProducts.length,
    eventCount: events.length
  });
}

main().catch((error) => {
  const logger = createLogger();
  logger.error('Stock check failed', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  process.exitCode = 1;
});
