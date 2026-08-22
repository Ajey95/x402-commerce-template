import 'dotenv/config';

const resources = [
  { id: 'weather', price: 2_000, result: 'validated' },
  { id: 'company-lookup', price: 3_000, result: 'validated' },
  { id: 'sentiment-score', price: 2_000, result: 'validated' },
] as const;
const declared = resources.map(resource => ({ ...resource, maxPayment: 3_000 }));
const serviceFee = 1_000;
const upfront = declared.reduce((sum, resource) => sum + resource.maxPayment, serviceFee);
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
  note: 'SIMULATION — NO REAL FUNDS',
}, null, 2));
