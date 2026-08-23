import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createPayingClient, explainPaymentError } from './lib.js';
import { createDemoShieldRequest, requestShieldJobWithProof } from './shield-client.js';

async function main() {
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const payer = createPayingClient();
  const request = createDemoShieldRequest(
    baseUrl,
    `job_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    payer.network.name,
  );
  console.log('CPMM-SHIELD scripted flow');
  console.log(`1. Discover and quote ${baseUrl}/api/shield/execute`);
  console.log(`2. Pay once from client ${payer.signer.address}`);
  const result = await requestShieldJobWithProof(baseUrl, request, {
    fetchWithPayment: payer.fetchWithPayment,
    readSettlement: response => payer.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
  });
  console.log(`3. Upstream settlement confirmed: ${result.transaction}`);
  console.log('4. Aggregated signed receipt:');
  console.log(JSON.stringify(result.receipt, null, 2));
}

main().catch(error => {
  console.error(`\nScripted shield demo failed: ${explainPaymentError(error)}`);
  process.exitCode = 1;
});
