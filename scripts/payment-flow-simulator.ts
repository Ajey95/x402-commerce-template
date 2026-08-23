import { createDemoShieldRequest } from '../client/shield-client.js';
import { createResourceRegistry } from '../src/shield/registry.js';
import { getTrustedExternalProviders } from '../src/shield/trusted-providers.js';

const networkName = 'testnet';
const request = createDemoShieldRequest('https://shield.example', 'simulation', networkName);
const registry = createResourceRegistry(
  'https://shield.example',
  getTrustedExternalProviders(networkName),
);
const resources = request.resources.map(resource => ({
  id: resource.id,
  price: registry.get(resource.id)!.priceAtomic,
  maxPayment: resource.maxPayment,
  result: resource.id === 'external-algo-price' ? 'provider content validated' : 'simulated content validated',
}));
const serviceFee = 1_000;
const upfront = resources.reduce((sum, resource) => sum + resource.maxPayment, serviceFee);
const spent = resources.reduce((sum, resource) => sum + resource.price, 0);
const remaining = upfront - spent - serviceFee;
const usdc = (atomic: number) => (atomic / 1_000_000).toFixed(6);

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  CPMM-SHIELD SIMULATION — NO REAL FUNDS             ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`Client ── HTTP 402 / ${usdc(upfront)} USDC ──▶ Shield`);
console.log('                       │');
for (const resource of resources) {
  console.log(`                       ├─▶ ${resource.id.padEnd(18)} ${usdc(resource.price)}  ✓ ${resource.result}`);
}
console.log('                       │');
console.log(`                       ├─  service fee          ${usdc(serviceFee)}`);
console.log(`                       └─  remaining budget     ${usdc(remaining)}`);
console.log('');
console.log(JSON.stringify({
  status: 'COMPLETED',
  summary: { requested: 3, completed: 3, failed: 0, rejections: 0 },
  payments: {
    upfront: usdc(upfront),
    downstream: usdc(spent),
    serviceFee: usdc(serviceFee),
    remaining: usdc(remaining),
  },
  network: networkName,
  contentBoundary: 'Owned results are simulated content; external-algo-price is provider content.',
  note: 'SIMULATION — NO REAL FUNDS',
}, null, 2));
