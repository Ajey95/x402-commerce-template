import 'dotenv/config';
import {
  createPayingClient,
  explainPaymentError,
  readPaymentRequired,
  resourceUrl,
} from './lib.js';

async function main() {
  const url = resourceUrl();
  const payer = createPayingClient();

  console.log('Requesting CPMM-SHIELD legacy paid resource...');
  const unpaid = await fetch(url);
  if (unpaid.status !== 402) {
    throw new Error(`Expected the payment challenge, but received HTTP ${unpaid.status}.`);
  }

  const requirement = readPaymentRequired(unpaid);
  console.log('\n402 Payment Required');
  if (requirement) {
    console.log(`Price: ${requirement.price} USDC`);
    console.log(`Network: ${requirement.network}`);
  }

  console.log(`Payer: ${payer.signer.address}`);
  console.log('Preparing and signing payment...');
  console.log('Submitting paid request...');

  const response = await payer.fetchWithPayment(url);
  if (!response.ok) {
    throw new Error(`Paid request returned HTTP ${response.status}: ${await response.text()}`);
  }

  const settlement = payer.httpClient.getPaymentSettleResponse(name => response.headers.get(name));
  if (!settlement.success) {
    throw new Error(`The resource responded, but settlement was not confirmed: ${JSON.stringify(settlement)}`);
  }

  console.log('\n✓ Payment accepted and settlement confirmed');
  console.log('✓ Resource unlocked');
  console.log(`Transaction ID: ${settlement.transaction}`);
  const explorerNetwork = payer.network.name === 'testnet' ? 'testnet.' : '';
  console.log(`Explorer: https://${explorerNetwork}explorer.perawallet.app/tx/${settlement.transaction}`);
  console.log('\nPaid resource:');
  console.log(JSON.stringify(await response.json(), null, 2));
}

main().catch(error => {
  console.error(`\nPaid demo failed: ${explainPaymentError(error)}`);
  process.exit(1);
});
