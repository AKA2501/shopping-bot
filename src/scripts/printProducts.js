import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { fetchProteinProducts } from '../productApiClient.js';
import { normalizeProducts } from '../stockNormalizer.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const rawProducts = await fetchProteinProducts(config, logger);
  const normalizedProducts = normalizeProducts(rawProducts, config, logger);
  console.log(JSON.stringify(normalizedProducts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

