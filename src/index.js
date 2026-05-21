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

async function processWatchTarget(config, target, supabase, logger, runId, observedAt) {
  const targetConfig = {
    ...config,
    productCategory: target.category,
    pincode: target.pincode,
    emailRecipients: target.recipients
  };

  logger.info('Processing watch target', {
    target: target.key,
    category: target.category,
    pincode: target.pincode,
    recipients: target.recipients
  });

  const rawProducts = await fetchProteinProducts(targetConfig, logger);
  const normalizedProducts = normalizeProducts(rawProducts, targetConfig, logger);
  const previousRows = await loadCachedProductsBySkus(
    supabase,
    target,
    normalizedProducts.map((product) => product.sku)
  );

  const { alertEvents, cacheRows, isInitialSnapshot } = compareStock(
    previousRows,
    normalizedProducts,
    target,
    runId,
    observedAt,
    {
      lowStockThreshold: config.lowStockThreshold
    }
  );

  logger.info('Compared stock snapshot', {
    target: target.key,
    productCount: normalizedProducts.length,
    alertEventCount: alertEvents.length,
    isInitialSnapshot
  });

  if (config.dryRun) {
    logger.info('Dry run: skipping stock event inserts and cache updates', {
      target: target.key,
      eventCount: alertEvents.length,
      cacheRowCount: cacheRows.length
    });
  } else {
    await insertStockEvents(supabase, alertEvents);
    await upsertProductCache(supabase, cacheRows);
  }

  await sendGroupedStockEmail(
    config,
    logger,
    target,
    alertEvents,
    normalizedProducts,
    runId,
    isInitialSnapshot
  );

  return {
    target,
    productCount: normalizedProducts.length,
    alertEventCount: alertEvents.length,
    isInitialSnapshot
  };
}

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
    workflowRunId: config.workflowRunId,
    targetCount: config.watchTargets.length
  });

  const results = [];

  for (const target of config.watchTargets) {
    results.push(await processWatchTarget(config, target, supabase, logger, runId, observedAt));
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
    targetCount: results.length,
    results
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
