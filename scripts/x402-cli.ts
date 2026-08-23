import 'dotenv/config';
import algosdk from 'algosdk';
import { existsSync, readFileSync } from 'node:fs';

const command = process.argv[2] ?? 'help';
const set = (name: string) => Boolean(process.env[name]?.trim());
const validAddress = (name: string) => set(name) && algosdk.isValidAddress(process.env[name]!.trim());
const hasSource = (path: string, pattern: RegExp) => existsSync(path) && pattern.test(readFileSync(path, 'utf8'));

function printHelp() {
  console.log('CPMM-SHIELD x402 CLI\n\nCommands:\n  inspect      Print non-secret runtime configuration\n  checklist   Report deployment readiness per subsystem\n  help        Show this message');
}

function inspect() {
  console.log(JSON.stringify({
    service: 'cpmm-shield',
    endpoint: 'POST /api/shield/execute',
    network: process.env.ALGORAND_NETWORK ?? 'testnet (default)',
    facilitatorUrl: process.env.FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz',
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000 (default)',
    payTo: validAddress('PAY_TO_ADDRESS') ? process.env.PAY_TO_ADDRESS : '<missing or invalid>',
    treasuryMnemonic: set('TREASURY_MNEMONIC') ? '<configured>' : '<missing>',
    clientMnemonic: set('CLIENT_MNEMONIC') ? '<configured>' : '<missing>',
    maxJobSpendAtomic: process.env.SHIELD_MAX_JOB_SPEND ?? '20000 (default)',
    maxResourcePaymentAtomic: process.env.SHIELD_MAX_RESOURCE_PAYMENT ?? '10000 (default)',
    maxResources: process.env.SHIELD_MAX_RESOURCES ?? '3 (default)',
    quoteExpirySeconds: process.env.QUOTE_EXPIRY_SECONDS ?? '120 (default)',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5.6 (default)',
  }, null, 2));
}

function checklist() {
  const checks: Array<[string, boolean, string]> = [
    ['x402 config', hasSource('src/x402/config.ts', /POST \/api\/shield\/execute/), 'dynamic protected route registered'],
    ['facilitator config', /^https?:\/\//.test(process.env.FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz'), 'HTTP(S) facilitator URL'],
    ['receiver config', validAddress('PAY_TO_ADDRESS'), 'valid public PAY_TO_ADDRESS required at deploy'],
    ['treasury config', set('TREASURY_MNEMONIC'), 'disposable TestNet treasury mnemonic required for live orchestration'],
    [
      'resource registry',
      hasSource('src/shield/trusted-providers.ts', /external-algo-price/) &&
        hasSource('src/shield/trusted-providers.ts', /external-hash/),
      'three owned plus one network-selected external provider',
    ],
    ['spending policy', hasSource('src/shield/policy.ts', /job_over_budget/), 'per-resource and total budget limits'],
    ['replay protection', hasSource('src/shield/payment-manager.ts', /payment_replay/), 'proof reservation and path/job quote binding'],
    ['response validation', hasSource('src/shield/validator.ts', /prompt_injection_marker/), 'exact schema and marker rejection'],
    ['demo mode', process.env.DEMO_MODE !== 'true' || (set('CLIENT_MNEMONIC') && set('TREASURY_MNEMONIC')), 'disabled safely or both payer roles configured'],
    ['test suite', existsSync('test/shield-api.test.ts') && existsSync('test/shield-security.test.ts'), 'API, replay, policy, and validation tests present'],
  ];
  console.log('CPMM-SHIELD readiness checklist');
  for (const [name, ok, detail] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} ${detail}`);
  const ready = checks.every(([, ok]) => ok);
  console.log(`\nDeployment credentials: ${ready ? 'READY' : 'INCOMPLETE — add missing secrets in the hosting dashboard'}`);
}

if (command === 'inspect') inspect();
else if (command === 'checklist') checklist();
else printHelp();
