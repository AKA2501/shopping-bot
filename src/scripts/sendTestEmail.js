import { loadConfig } from '../config.js';
import { sendGroupedStockEmail } from '../emailSender.js';
import { createLogger } from '../logger.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();

  const sampleEvents = [
    {
      sku: 'TEST-WHEY-1KG',
      eventType: 'new_product',
      productName: 'Test Whey Protein 1KG',
      currentPrice: 1999,
      currentQuantity: 8,
      currentInStock: true,
      productUrl: `${config.productUrlBase}/TEST-WHEY-1KG`
    },
    {
      sku: 'TEST-ISO-2KG',
      eventType: 'restock',
      productName: 'Test Isolate 2KG',
      currentPrice: 3499,
      currentQuantity: 4,
      currentInStock: true,
      productUrl: `${config.productUrlBase}/TEST-ISO-2KG`
    }
  ];

  await sendGroupedStockEmail(config, logger, sampleEvents, 'test-run');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

