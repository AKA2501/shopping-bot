import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { fetchProteinProducts } from '../productApiClient.js';
import { normalizeProducts } from '../stockNormalizer.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const outputs = [];

  for (const target of config.watchTargets) {
    const targetConfig = {
      ...config,
      productCategory: target.category,
      pincode: target.pincode
    };
    const rawProducts = await fetchProteinProducts(targetConfig, logger);
    const normalizedProducts = normalizeProducts(rawProducts, targetConfig, logger);
    outputs.push({
      target,
      products: normalizedProducts
    });
  }

  console.log(JSON.stringify(outputs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
