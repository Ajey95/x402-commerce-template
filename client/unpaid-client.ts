import 'dotenv/config';
import { readPaymentRequired, resourceUrl } from './lib.js';

async function main() {
  const url = resourceUrl();
  console.log('Requesting CPMM-SHIELD legacy paid resource without payment...');
  console.log(`Resource URL: ${url}\n`);

  const response = await fetch(url);
  console.log(`HTTP ${response.status} ${response.statusText}`);

  if (response.status !== 402) {
    console.log(await response.text());
    throw new Error('Expected HTTP 402. Check that the requested route is protected by x402.');
  }

  const requirement = readPaymentRequired(response);
  console.log('\nPayment required before resource access.');
  if (requirement) {
    console.log(`Resource: ${requirement.description}`);
    console.log(`Price: ${requirement.price} USDC`);
    console.log(`Network: ${requirement.network}`);
    console.log(`Asset: ${requirement.asset}`);
  } else {
    console.log('The server returned a payment requirement that this demo client could not summarize.');
  }
}

main().catch(error => {
  console.error(`\nUnpaid demo failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
