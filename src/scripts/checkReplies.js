import { processReplyInbox } from '../authorizedOrderService.js';
import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { getSupabaseClient } from '../supabaseClient.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const supabase = getSupabaseClient(config);
  await processReplyInbox(config, supabase, logger);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
