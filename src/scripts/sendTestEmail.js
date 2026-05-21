import { loadConfig } from '../config.js';
import { sendGroupedStockEmail } from '../emailSender.js';
import { createLogger } from '../logger.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const target = config.defaultTarget;

  const sampleAlerts = [
    {
      sku: 'TEST-WHEY-1KG',
      eventType: 'restock',
      productName: 'Test Whey Protein 1KG',
      currentPrice: 1999,
      currentQuantity: 8,
      currentInStock: true,
      productUrl: `${config.productUrlBase}/TEST-WHEY-1KG`,
      pincode: target.pincode,
      metadata: {
        currency: 'INR'
      }
    },
    {
      sku: 'TEST-ISO-2KG',
      eventType: 'out_of_stock',
      productName: 'Test Isolate 2KG',
      currentPrice: 3499,
      currentQuantity: 0,
      currentInStock: false,
      productUrl: `${config.productUrlBase}/TEST-ISO-2KG`,
      pincode: target.pincode,
      metadata: {
        currency: 'INR'
      }
    }
  ];

  await sendGroupedStockEmail(
    config,
    logger,
    target,
    sampleAlerts,
    [],
    'test-run',
    false
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
