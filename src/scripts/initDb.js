import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { getSupabaseClient, verifyTables } from '../supabaseClient.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const supabase = getSupabaseClient(config);
  const results = await verifyTables(supabase);

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    logger.info('Supabase table check', result);
  }

  if (failed.length) {
    throw new Error(
      'One or more required tables are missing or inaccessible. Apply sql/schema.sql in Supabase, then rerun npm run db:init.'
    );
  }

  logger.info('Supabase schema looks ready');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

