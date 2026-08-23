# CPMM-SHIELD Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade CPMM-SHIELD from a same-origin simulated orchestration demo into a hackathon-complete settlement-first x402 payment firewall that supports trusted external providers, provider-specific inputs, bounded AI tool use, VibeKit/Algorand agent guidance, stronger validation, and judge-ready observability.

**Architecture:** Preserve the existing Hono + official `@x402/*` AVM payment stack, GoPlausible facilitator, settlement-first middleware, treasury payer, and signed receipt flow. Move all security-sensitive provider metadata to a server-owned trusted registry; clients submit only trusted resource IDs, bounded provider-specific input, payment ceilings, and required flags. VibeKit remains a coding-agent knowledge/tooling layer and never enters the runtime transaction path.

**Tech Stack:** Node 20+, TypeScript 5.9, Hono 4, `@x402/core`, `@x402/hono`, `@x402/fetch`, `@x402/avm`, `@x402-avm/extensions`, Algorand SDK 3.6, Zod 3.25, Vitest 4, pnpm 10, OpenAI Responses API, GoPlausible facilitator.

**Spec:** `docs/superpowers/specs/2026-08-23-cpmm-shield-complete-design.md`

## Global Constraints

- Preserve settlement-before-execution.
- Invalid input must fail before x402 middleware and before any payment challenge.
- Runtime payments continue to use the existing official `@x402/*` AVM stack.
- VibeKit/Algorand Agent Skills are development guidance only, not runtime payment dependencies.
- Client requests may not choose arbitrary provider URLs, pay-to addresses, networks, assets, or response schemas.
- `PAY_TO_ADDRESS` remains a public upstream receiver address only.
- `CLIENT_MNEMONIC` remains disposable TestNet buyer/demo credentials only.
- `TREASURY_MNEMONIC` remains the isolated downstream payer and receipt signer in the hackathon implementation.
- `DEMO_MODE=true` remains TestNet-only.
- Replayed payment proofs remain rejected.
- Downstream HTTP success is insufficient; settlement and response validation are both mandatory.
- Demo providers remain visibly labeled `SIMULATED CONTENT / REAL TESTNET PAYMENT`.
- In-memory jobs, replay state, and audit state remain explicitly non-production.

---

## File Structure

### Core domain

- Modify `src/shield/types.ts` — request/provider/public metadata types.
- Modify `src/shield/request.ts` — parse only resource IDs, provider input, maxPayment, required.
- Create `src/shield/input-validator.ts` — exact provider-input schema validation.
- Modify `src/shield/registry.ts` — authoritative trusted provider definitions.
- Modify `src/shield/policy.ts` — registry-driven trust and input/budget checks.
- Create `src/shield/provider-request.ts` — maps trusted provider definitions + input to URL/body.
- Modify `src/shield/treasury.ts` — call provider-request mapper instead of hardcoded demo arguments.
- Modify `src/shield/validator.ts` only where needed for provider-specific response hooks.

### API and x402 metadata

- Modify `src/routes/shield.ts` — safe registry metadata and new request semantics.
- Modify `src/x402/config.ts` — Bazaar input example/schema for new request contract.
- Modify `src/routes/resources.ts` only to keep owned demo providers compatible with the new input contract.

### Clients and agent

- Modify `client/shield-client.ts` — generate new ID/input request format.
- Modify `client/agent-client.ts` — expose bounded resource selection/input tool schema.
- Modify `client/scripted-shield-client.ts` if it assumes legacy request fields.
- Modify `client/lib.ts` only if shared request helpers require it.

### Dashboard

- Modify `src/web/page.ts` — judge-oriented labels/sections.
- Modify `src/web/app-script.ts` — new request shape and richer receipt/provider rendering.
- Modify `src/web/styles.ts` only for new status rows/badges.

### Agent guidance/docs

- Modify `AGENTS.md` — merge VibeKit/Algorand-x402 guidance with repo invariants.
- Modify `skills.md` — add CPMM-SHIELD trusted-provider workflow.
- Create `docs/resources/HACKCULTURE_RESOURCES.md` — exact organizer-provided resources.
- Create `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` — how coding agents should use VibeKit/Algorand skills.
- Modify `README.md` and `PROJECT_BRIEF.md` — updated request contract, external-provider capability, demo boundary.

### Tests

- Modify `test/shield-domain.test.ts` — registry, input, and policy security.
- Modify `test/shield-api.test.ts` — pre-payment validation and 402 contract.
- Modify `test/resource-client.test.ts` — provider-specific request mapping and downstream safety.
- Modify `test/orchestrator.test.ts` — partial failures and signed receipt semantics.
- Modify `test/shield-client.test.ts` — new client request contract.
- Modify `test/app.test.ts` — public registry and page metadata.
- Add `test/provider-request.test.ts` if request-adapter coverage becomes clearer as an isolated unit.

---

### Task 1: Replace client-controlled provider security fields with server-owned request semantics

**Files:**
- Modify: `src/shield/types.ts`
- Modify: `src/shield/request.ts`
- Create: `src/shield/input-validator.ts`
- Test: `test/shield-domain.test.ts`

**Interfaces:**
- Produces:
  - `RequestedResource = { id: string; input: Record<string, unknown>; maxPayment: number; required: boolean }`
  - `ResourceDefinition.inputSchema: JsonObjectSchema`
  - `validateExactObject(input: unknown, schema: JsonObjectSchema): ValidationResult`
- Consumed by Tasks 2–7.

- [ ] **Step 1: Write failing request-contract tests**

Add to `test/shield-domain.test.ts`:

```ts
import { parseExecuteShieldRequest } from '../src/shield/request.js';

it('parses trusted resource ids with bounded provider input only', () => {
  expect(parseExecuteShieldRequest({
    requestId: 'job_123',
    resources: [{
      id: 'weather',
      input: { city: 'Bangalore' },
      maxPayment: 3_000,
      required: true,
    }],
  })).toEqual({
    requestId: 'job_123',
    resources: [{
      id: 'weather',
      input: { city: 'Bangalore' },
      maxPayment: 3_000,
      required: true,
    }],
  });
});

it.each(['url', 'expectedSchema'])('rejects client-controlled %s fields', field => {
  const resource = {
    id: 'weather',
    input: { city: 'Bangalore' },
    maxPayment: 3_000,
    required: true,
    [field]: field === 'url' ? 'https://attacker.example/pay' : { type: 'object' },
  };
  expect(() => parseExecuteShieldRequest({ requestId: 'job_123', resources: [resource] }))
    .toThrow(/unrecognized|invalid_request/i);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
pnpm vitest run test/shield-domain.test.ts
```

Expected: FAIL because the parser still requires `url` and `expectedSchema`.

- [ ] **Step 3: Change the domain types**

Update `src/shield/types.ts` so the request type is:

```ts
export type JsonObject = Record<string, unknown>;

export interface RequestedResource {
  id: string;
  input: JsonObject;
  maxPayment: number;
  required: boolean;
}
```

Extend `ResourceDefinition` to:

```ts
export interface ResourceDefinition {
  id: string;
  name: string;
  origin: string;
  method: 'GET' | 'POST';
  path: string;
  priceAtomic: number;
  maxPriceAtomic?: number;
  inputSchema: JsonObjectSchema;
  responseSchema: JsonObjectSchema;
  trust: 'owned-demo' | 'external-curated';
  description: string;
  tags: string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
}
```

Keep `JsonObjectSchema` exact-object semantics with `additionalProperties: false`.

- [ ] **Step 4: Replace request parsing**

In `src/shield/request.ts`, define:

```ts
const resourceInput = z.record(z.unknown()).default({});

const requestedResource = z.object({
  id: z.string().min(1).max(80),
  input: resourceInput,
  maxPayment: z.number().int().nonnegative(),
  required: z.boolean().default(true),
}).strict();
```

Keep request ID validation unchanged.

- [ ] **Step 5: Add exact object input validation**

Create `src/shield/input-validator.ts`:

```ts
import type { JsonObjectSchema } from './types.js';

export type InputValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: 'invalid_resource_input'; reason: string };

export function validateExactObject(input: unknown, schema: JsonObjectSchema): InputValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'invalid_resource_input', reason: 'Resource input must be a JSON object.' };
  }
  const record = input as Record<string, unknown>;
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return { ok: false, code: 'invalid_resource_input', reason: `Unexpected resource input field: ${key}.` };
  }
  for (const key of schema.required) {
    if (!(key in record)) return { ok: false, code: 'invalid_resource_input', reason: `Missing resource input field: ${key}.` };
  }
  for (const [key, property] of Object.entries(schema.properties)) {
    const value = record[key];
    if (value === undefined && !schema.required.includes(key)) continue;
    if (typeof value !== property.type) return { ok: false, code: 'invalid_resource_input', reason: `Resource input field ${key} must be ${property.type}.` };
    if (typeof value === 'number' && !Number.isFinite(value)) return { ok: false, code: 'invalid_resource_input', reason: `Resource input field ${key} must be finite.` };
    if (typeof value === 'string' && property.maxLength !== undefined && value.length > property.maxLength) {
      return { ok: false, code: 'invalid_resource_input', reason: `Resource input field ${key} exceeds ${property.maxLength} characters.` };
    }
  }
  return { ok: true, data: structuredClone(record) };
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run test/shield-domain.test.ts
```

Expected: request parsing tests PASS; legacy policy tests may still fail until Task 2.

- [ ] **Step 7: Commit**

```bash
git add src/shield/types.ts src/shield/request.ts src/shield/input-validator.ts test/shield-domain.test.ts
git commit -m "refactor: move provider security fields to server"
```

---

### Task 2: Build the authoritative trusted provider registry and registry-driven policy

**Files:**
- Modify: `src/shield/registry.ts`
- Modify: `src/shield/policy.ts`
- Modify: `src/routes/shield.ts`
- Test: `test/shield-domain.test.ts`
- Test: `test/app.test.ts`

**Interfaces:**
- Consumes: `RequestedResource`, `ResourceDefinition`, `validateExactObject` from Task 1.
- Produces:
  - `createResourceRegistry(baseUrl: string, external?: ResourceDefinition[]): ResourceRegistry`
  - policy that validates provider existence + input + budgets without reading a client URL/schema.

- [ ] **Step 1: Rewrite policy test fixture to new request shape**

Use:

```ts
function request(overrides: Partial<ExecuteShieldRequest> = {}): ExecuteShieldRequest {
  return {
    requestId: 'job_123',
    resources: [{
      id: 'weather',
      input: { city: 'Bangalore' },
      maxPayment: 3_000,
      required: true,
    }],
    ...overrides,
  };
}
```

Add:

```ts
it('rejects unknown providers before payment', () => {
  const registry = createResourceRegistry(shieldConfig.baseUrl);
  expect(evaluatePolicy(request({ resources: [{
    ...request().resources[0]!, id: 'evil-provider',
  }] }), shieldConfig, registry)).toMatchObject({
    ok: false,
    code: 'resource_not_allowed',
  });
});

it('rejects invalid provider input before payment', () => {
  const registry = createResourceRegistry(shieldConfig.baseUrl);
  expect(evaluatePolicy(request({ resources: [{
    ...request().resources[0]!, input: { city: '', unexpected: true },
  }] }), shieldConfig, registry)).toMatchObject({
    ok: false,
    code: 'invalid_resource_input',
  });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
pnpm vitest run test/shield-domain.test.ts
```

Expected: FAIL because registry/policy still depend on URL matching.

- [ ] **Step 3: Make the registry authoritative**

For each owned resource in `src/shield/registry.ts`, set `origin` to `new URL(baseUrl).origin`, retain the current path/price, add names/descriptions/tags, define exact input schemas, and rename response `schema` to `responseSchema`.

Example weather definition:

```ts
{
  id: 'weather',
  name: 'Weather',
  origin,
  method: 'GET',
  path: '/api/resources/weather',
  priceAtomic: 2_000,
  inputSchema: {
    type: 'object',
    required: ['city'],
    additionalProperties: false,
    properties: { city: { type: 'string', maxLength: 80 } },
  },
  responseSchema: { /* existing exact response schema */ },
  trust: 'owned-demo',
  description: 'Deterministic simulated weather payload behind a real x402 payment boundary.',
  tags: ['cpmm-shield', 'weather', 'simulated-content'],
}
```

Use equivalent schemas for `{ name }` and `{ text }`.

Support explicit curated external definitions through an optional second argument and reject duplicate IDs when building the map.

- [ ] **Step 4: Replace URL policy with registry/input policy**

In `src/shield/policy.ts`:

```ts
const definition = registry.get(resource.id);
if (!definition) return reject('resource_not_allowed', `Resource ${resource.id} is not registered.`);

const input = validateExactObject(resource.input, definition.inputSchema);
if (!input.ok) return reject(input.code, input.reason);
```

Retain duplicate resource ID checks, resource count, safe integer maxPayment, global resource cap, provider price vs caller ceiling, and max-job-spend checks.

Remove client URL parsing, private-host checks, and `matchesDefinition()` from policy because clients no longer supply URLs.

- [ ] **Step 5: Return safe public registry metadata**

Update `/api/shield/resources` to return:

```ts
{
  id,
  name,
  method,
  origin,
  path,
  priceAtomic,
  trust,
  description,
  tags,
  inputSchema,
  content: trust === 'owned-demo' ? 'SIMULATED CONTENT' : 'PROVIDER CONTENT',
  payment: 'REAL X402 PAYMENT',
}
```

Never return mnemonics, signer material, internal bindings, or secret configuration.

- [ ] **Step 6: Run domain/app tests**

```bash
pnpm vitest run test/shield-domain.test.ts test/app.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shield/registry.ts src/shield/policy.ts src/routes/shield.ts test/shield-domain.test.ts test/app.test.ts
git commit -m "feat: add authoritative trusted provider registry"
```

---

### Task 3: Add provider-specific request adapters and remove hardcoded treasury inputs

**Files:**
- Create: `src/shield/provider-request.ts`
- Modify: `src/shield/treasury.ts`
- Test: `test/provider-request.test.ts`
- Modify/Test: `test/resource-client.test.ts`

**Interfaces:**
- Consumes: `RequestedResource`, `ResourceDefinition`.
- Produces:
  - `buildProviderRequest(request: RequestedResource, definition: ResourceDefinition, timeoutMs: number): { url: string; init: RequestInit }`

- [ ] **Step 1: Add failing adapter tests**

Create `test/provider-request.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProviderRequest } from '../src/shield/provider-request.js';
import { createResourceRegistry } from '../src/shield/registry.js';

const registry = createResourceRegistry('https://shield.example');

describe('provider request mapping', () => {
  it('maps weather input to a GET query string', () => {
    const definition = registry.get('weather')!;
    const built = buildProviderRequest({
      id: 'weather', input: { city: 'New York' }, maxPayment: 3_000, required: true,
    }, definition, 5_000);
    expect(built.url).toBe('https://shield.example/api/resources/weather?city=New+York');
    expect(built.init.method).toBe('GET');
    expect(built.init.body).toBeUndefined();
  });

  it('maps sentiment input to an exact POST body', () => {
    const definition = registry.get('sentiment-score')!;
    const built = buildProviderRequest({
      id: 'sentiment-score', input: { text: 'Secure and fast.' }, maxPayment: 3_000, required: true,
    }, definition, 5_000);
    expect(built.url).toBe('https://shield.example/api/resources/sentiment-score');
    expect(built.init.method).toBe('POST');
    expect(built.init.body).toBe(JSON.stringify({ text: 'Secure and fast.' }));
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm vitest run test/provider-request.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement request mapping**

Create `src/shield/provider-request.ts` with a small switch limited to trusted provider IDs for built-ins and a generic exact mapping rule for curated providers:

```ts
export function buildProviderRequest(
  request: RequestedResource,
  definition: ResourceDefinition,
  timeoutMs: number,
): { url: string; init: RequestInit } {
  const url = new URL(definition.path, definition.origin);
  const base: RequestInit = {
    method: definition.method,
    redirect: 'manual',
    signal: AbortSignal.timeout(definition.timeoutMs ?? timeoutMs),
    headers: { accept: 'application/json' },
  };

  if (definition.method === 'GET') {
    for (const [key, value] of Object.entries(request.input)) url.searchParams.set(key, String(value));
    return { url: url.toString(), init: base };
  }

  return {
    url: url.toString(),
    init: {
      ...base,
      headers: { ...base.headers, 'content-type': 'application/json' },
      body: JSON.stringify(request.input),
    },
  };
}
```

Because Task 2 validates `request.input` against an exact schema, this mapper never sees arbitrary extra keys.

- [ ] **Step 4: Wire treasury client to the mapper**

Replace `callUrl()` and `requestInit()` in `src/shield/treasury.ts` with:

```ts
const built = buildProviderRequest(request, definition, options.timeoutMs);
response = await payer.fetchWithPayment(built.url, built.init);
```

Use `definition.maxResponseBytes ?? options.maxResponseBytes` for response-size checks.

Use `definition.responseSchema` later in the orchestrator.

- [ ] **Step 5: Extend downstream client safety tests**

In `test/resource-client.test.ts`, assert the paying client receives the expected provider-specific URL/body and retain tests for redirects, HTTP errors, missing settlement, wrong content type, oversized response, and malformed JSON.

- [ ] **Step 6: Run adapter/client tests**

```bash
pnpm vitest run test/provider-request.test.ts test/resource-client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shield/provider-request.ts src/shield/treasury.ts test/provider-request.test.ts test/resource-client.test.ts
git commit -m "feat: add provider-specific x402 request adapters"
```

---

### Task 4: Update orchestration to use server response schemas and explicit required-resource semantics

**Files:**
- Modify: `src/shield/orchestrator.ts`
- Modify: `src/shield/validator.ts` only if signature/name cleanup is required.
- Test: `test/orchestrator.test.ts`
- Test: `test/shield-security.test.ts`

**Interfaces:**
- Consumes: `definition.responseSchema` from Task 2.
- Produces: receipts that never trust client-provided schema and accurately report partial/required failures.

- [ ] **Step 1: Add failing schema-authority test**

In `test/orchestrator.test.ts`, construct a trusted weather definition with a response schema that requires `city`, `temperature`, etc., have the resource client return an object missing `city`, and assert the outcome is `validation: 'rejected'` even though the request itself contains no response schema.

Use:

```ts
expect(receipt.resources[0]).toMatchObject({
  id: 'weather',
  paymentStatus: 'settled',
  validation: 'rejected',
  errorCode: 'missing_field',
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm vitest run test/orchestrator.test.ts
```

Expected: compile/runtime failure because orchestrator still uses `definition.schema` or old request types.

- [ ] **Step 3: Switch orchestrator validation to registry response schema**

Replace:

```ts
validateResourceResponse(call.data, definition.schema)
```

with:

```ts
validateResourceResponse(call.data, definition.responseSchema)
```

Retain the important rule that a settled-but-invalid response increments downstream spend.

- [ ] **Step 4: Make required semantics visible**

Compute terminal status using both completion count and whether any required resource failed:

```ts
const requiredFailed = job.request.resources.some(request => {
  if (!request.required) return false;
  const outcome = resources.find(item => item.id === request.id);
  return !outcome || outcome.validation !== 'passed';
});

const status = requiredFailed
  ? (completed === 0 ? 'FAILED' : 'PARTIAL_FAILURE')
  : failed === 0 ? 'COMPLETED' : 'PARTIAL_FAILURE';
```

Optional failures therefore yield `PARTIAL_FAILURE` but retain valid results; required failures can never be reported as `COMPLETED`.

- [ ] **Step 5: Keep injection and exact-schema tests green**

Run:

```bash
pnpm vitest run test/orchestrator.test.ts test/shield-security.test.ts
```

Expected: PASS, including prompt-injection-marker rejection.

- [ ] **Step 6: Commit**

```bash
git add src/shield/orchestrator.ts src/shield/validator.ts test/orchestrator.test.ts test/shield-security.test.ts
git commit -m "feat: enforce server-owned response validation"
```

---

### Task 5: Update quote/API/x402 discovery metadata to the new secure request contract

**Files:**
- Modify: `src/routes/shield.ts`
- Modify: `src/x402/config.ts`
- Modify: `src/shield/quote.ts` only if request hashing/binding serialization needs field updates.
- Test: `test/shield-api.test.ts`
- Test: `test/app.test.ts`

**Interfaces:**
- Consumes: new request contract from Task 1 and registry metadata from Task 2.
- Produces: official 402 challenge/Bazaar metadata that no longer advertises client URLs/schemas.

- [ ] **Step 1: Add failing API boundary test**

In `test/shield-api.test.ts`, send:

```ts
const request = {
  requestId: 'job_123',
  resources: [{
    id: 'weather',
    input: { city: 'Bangalore' },
    maxPayment: 3_000,
    required: true,
  }],
};
```

Assert:

```ts
expect(response.status).toBe(402);
expect(response.headers.get('payment-required')).toBeTruthy();
```

Also send an unknown provider or invalid `input` and assert `400/4xx` before any payment-required header is emitted.

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm vitest run test/shield-api.test.ts
```

- [ ] **Step 3: Update Bazaar discovery input example**

In `src/x402/config.ts`, change the shield discovery example to:

```ts
input: {
  requestId: 'job_123',
  resources: [{
    id: 'weather',
    input: { city: 'Bangalore' },
    maxPayment: 3000,
    required: true,
  }],
},
```

Describe resources as trusted IDs with bounded provider input and caller payment ceilings. Remove any text implying the caller supplies provider URLs or response schemas.

Keep `bazaarResourceServerExtension`, `declareDiscoveryExtension`, Exact AVM scheme registration, dynamic price function, GoPlausible facilitator use, and challenge tag behavior unchanged.

- [ ] **Step 4: Ensure quote hashing/binding naturally includes provider input**

If `src/shield/quote.ts` hashes `JSON.stringify(request)`, no algorithm change is required; update only tests/types. If it manually selects legacy fields, include `{ id, input, maxPayment, required }` deterministically.

- [ ] **Step 5: Run API/app tests**

```bash
pnpm vitest run test/shield-api.test.ts test/app.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/shield.ts src/x402/config.ts src/shield/quote.ts test/shield-api.test.ts test/app.test.ts
git commit -m "feat: publish secure shield discovery contract"
```

---

### Task 6: Upgrade scripted and OpenAI clients to bounded trusted-resource selection

**Files:**
- Modify: `client/shield-client.ts`
- Modify: `client/agent-client.ts`
- Modify: `client/scripted-shield-client.ts`
- Test: `test/shield-client.test.ts`
- Test: `test/openai-model.test.ts` only if model helper behavior changes.

**Interfaces:**
- Consumes: trusted registry public metadata and new request contract.
- Produces: a deterministic demo request and a single bounded `requestShieldJob` OpenAI tool.

- [ ] **Step 1: Update client unit expectations first**

In `test/shield-client.test.ts`, assert `createDemoShieldRequest()` returns:

```ts
{
  requestId: 'job_demo',
  resources: [
    { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 3_000, required: true },
    { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3_000, required: true },
    { id: 'sentiment-score', input: { text: 'Algorand enables secure, scalable agentic payments.' }, maxPayment: 3_000, required: true },
  ],
}
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm vitest run test/shield-client.test.ts
```

- [ ] **Step 3: Update deterministic shield request builder**

Simplify `createDemoShieldRequest` so it no longer constructs URLs or schemas and no longer needs `baseUrl` except for backward API compatibility. Prefer changing the signature to:

```ts
export function createDemoShieldRequest(requestId: string): ExecuteShieldRequest
```

Then update all call sites.

- [ ] **Step 4: Replace the OpenAI tool schema**

In `client/agent-client.ts`, expose exactly one function tool:

```ts
{
  type: 'function',
  name: 'requestShieldJob',
  description: 'Buy one bounded CPMM-SHIELD job using only trusted x402 resources.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      resources: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: ['weather', 'company-lookup', 'sentiment-score'] },
            input: { type: 'object', additionalProperties: true },
            maxPayment: { type: 'integer', minimum: 0, maximum: 10000 },
            required: { type: 'boolean' },
          },
          required: ['id', 'input', 'maxPayment', 'required'],
          additionalProperties: false,
        },
      },
    },
    required: ['resources'],
    additionalProperties: false,
  },
}
```

Use the function call arguments to create the `ExecuteShieldRequest` with a generated request ID. The server remains authoritative and rejects invalid resource/input combinations.

Keep the system instruction explicit:

```text
Use requestShieldJob at most once. Choose only listed trusted resources. Never invent URLs, payment recipients, schemas, networks, or assets. Summarize only validated results from the signed receipt.
```

- [ ] **Step 5: Keep deterministic demo path**

The scripted client must still provide the three-provider judge flow without requiring model reasoning.

- [ ] **Step 6: Run client tests/build**

```bash
pnpm vitest run test/shield-client.test.ts test/openai-model.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/shield-client.ts client/agent-client.ts client/scripted-shield-client.ts test/shield-client.test.ts test/openai-model.test.ts
git commit -m "feat: bound AI commerce tool to trusted resources"
```

---

### Task 7: Upgrade the operations dashboard for judge-facing trust and payment visibility

**Files:**
- Modify: `src/web/page.ts`
- Modify: `src/web/app-script.ts`
- Modify: `src/web/styles.ts`
- Test: `test/app.test.ts`

**Interfaces:**
- Consumes: `/health`, `/api/shield/resources`, `/api/shield/audit`, `/api/shield/jobs/:jobId`, new request contract.
- Produces: browser demo that clearly distinguishes quote, upstream settlement, treasury payments, validation, and signed receipt.

- [ ] **Step 1: Add page-content expectations**

In `test/app.test.ts`, assert `/` contains all of:

```ts
expect(html).toContain('One payment in. Many protected resources out.');
expect(html).toContain('Upstream payment');
expect(html).toContain('Trusted providers');
expect(html).toContain('Response firewall');
expect(html).toContain('Signed receipt');
expect(html).toContain('SIMULATED CONTENT');
```

- [ ] **Step 2: Run and confirm any missing expectations**

```bash
pnpm vitest run test/app.test.ts
```

- [ ] **Step 3: Update browser request construction**

Replace `makeRequest()` in `src/web/app-script.ts` with:

```js
function makeRequest(requestId) {
  return {
    requestId,
    resources: [
      { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 3000, required: true },
      { id: 'company-lookup', input: { name: 'Algorand Foundation' }, maxPayment: 3000, required: true },
      { id: 'sentiment-score', input: { text: 'Algorand enables secure, scalable agentic payments.' }, maxPayment: 3000, required: true }
    ]
  };
}
```

- [ ] **Step 4: Render trust metadata and provider outcomes**

Registry rows should show `name`, `trust`, `method + origin + path`, and atomic price. Owned demo resources display `SIMULATED CONTENT / REAL X402 PAYMENT`.

Receipt rows should show:

- `paymentStatus`
- `validation`
- `txnId` when present
- `amountAtomic`
- `durationMs`
- error code when rejected

The browser must never display mnemonics or private key material.

- [ ] **Step 5: Clarify lifecycle copy in `page.ts`**

Use visible stages:

```text
Request + policy → Bound 402 quote → Upstream settlement → Treasury x402 calls → Response firewall → Signed receipt
```

Make clear that `DEMO_MODE=false` only creates unpaid quotes from the browser and that CLI/live demo payer is required for real settlement.

- [ ] **Step 6: Run app tests/build**

```bash
pnpm vitest run test/app.test.ts
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/web/page.ts src/web/app-script.ts src/web/styles.ts test/app.test.ts
git commit -m "feat: make shield dashboard judge-ready"
```

---

### Task 8: Merge VibeKit/Algorand x402 guidance into the repository agent operating manual

**Files:**
- Modify: `AGENTS.md`
- Modify: `skills.md`
- Create: `docs/resources/HACKCULTURE_RESOURCES.md`
- Create: `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md`
- Modify: `docs/resources/IMPLEMENTATION_MAP.md`

**Interfaces:**
- Produces developer guidance only; no runtime imports or dependencies.

- [ ] **Step 1: Add the exact organizer resources index**

Create `docs/resources/HACKCULTURE_RESOURCES.md` with these categories and links exactly as supplied by the event dashboard:

```text
Start Here
- https://docs.x402.org/introduction
- https://dev.algorand.co/resources/x402-on-algorand/
- https://github.com/coinbase/x402
- https://x402-kit-kappa.vercel.app/

Setup
- https://pera.app/
- https://algorand.co/algokit
- https://www.getvibekit.ai/
- https://dev.algorand.co/

Build
- https://github.com/SomehowLiving/x402-commerce-template
- https://github.com/marotipatre/x402-Project

Test & Debug
- https://lora.algokit.io/
- https://testnet.explorer.perawallet.app/
- https://explorer.perawallet.app/

Discover & Track
- https://facilitator.goplausible.xyz/dashboard/
- https://facilitator.goplausible.xyz/dashboard/leaderboards?cat=resources

Additional
- https://quickest-reaction-568.notion.site/Algorand-Technical-Resources-2fea260a8fdc8096b969f2248a96617d
```

State that repo-local docs and official docs take precedence over generated summaries.

- [ ] **Step 2: Add VibeKit development guidance**

Create `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` with these explicit rules:

```text
- VibeKit is for coding-agent skills/MCP guidance, not CPMM-SHIELD runtime payments.
- When VibeKit/Algorand Agent Skills are available, use the Algorand x402 TypeScript guidance before editing payment code.
- Merge generated agent instructions with AGENTS.md; never overwrite repository-specific invariants.
- Never expose or paste mnemonics/private keys into model prompts or committed files.
- Preserve official x402 payment lifecycle and facilitator settlement.
- Verify Bazaar metadata after changing protected routes.
```

Document the user-facing setup flow as reference only:

```bash
npx vibekit init
npx vibekit status
```

Do not make these runtime package scripts or CI requirements.

- [ ] **Step 3: Strengthen `AGENTS.md`**

Add an `Agent Knowledge Layer` section:

```text
1. Read PROJECT_BRIEF.md, the approved design/spec, this AGENTS.md, and docs/resources first.
2. If VibeKit/Algorand Agent Skills are installed, use algorand-x402-typescript guidance for x402/AVM changes.
3. Project-specific invariants in this file override generic generated guidance.
4. Never put VibeKit into the runtime settlement path unless a future design explicitly requires it.
5. No completion claim until build/test/smoke verification is performed.
```

- [ ] **Step 4: Update `skills.md`**

Add `Skill: Add a trusted downstream x402 provider` with concrete steps:

```text
1. Add a ResourceDefinition with explicit origin/path/method/price/inputSchema/responseSchema/trust.
2. Add provider-request mapping tests.
3. Confirm policy rejects malformed input before payment.
4. Confirm treasury requires downstream settlement.
5. Add response validation tests.
6. Expose only safe metadata from /api/shield/resources.
7. Never auto-trust a Bazaar-discovered provider.
```

- [ ] **Step 5: Update implementation map**

Reference the new request/registry/adapter files so future coding agents know where each responsibility lives.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md skills.md docs/resources/HACKCULTURE_RESOURCES.md docs/resources/VIBEKIT_X402_AGENT_GUIDE.md docs/resources/IMPLEMENTATION_MAP.md
git commit -m "docs: add VibeKit and official x402 agent guidance"
```

---

### Task 9: Update product documentation and demo boundary

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_BRIEF.md`
- Modify: `.env.example` only if external-provider env configuration is introduced.

**Interfaces:**
- Produces accurate public documentation matching the implemented request contract.

- [ ] **Step 1: Update architecture/request examples**

The README request example must become:

```json
{
  "requestId": "job_123",
  "resources": [
    {
      "id": "weather",
      "input": { "city": "Bangalore" },
      "maxPayment": 3000,
      "required": true
    }
  ]
}
```

Explicitly state:

```text
Clients never submit provider URLs, recipient addresses, networks, assets, or response schemas. Those are owned by the trusted server registry.
```

- [ ] **Step 2: Document owned vs curated external providers**

README must distinguish:

```text
owned-demo      → simulated content, real x402 payment path
external-curated → provider content, trusted only after explicit allowlisting
Bazaar candidate → discoverable metadata only, never automatically trusted
```

- [ ] **Step 3: Document VibeKit accurately**

State that VibeKit is optional developer tooling for AI coding agents and not required to run CPMM-SHIELD.

- [ ] **Step 4: Keep production limitations explicit**

Preserve the current warnings about in-memory state, environment mnemonic custody, concurrency, narrow injection detection, and multi-replica persistence.

- [ ] **Step 5: Commit**

```bash
git add README.md PROJECT_BRIEF.md .env.example
git commit -m "docs: document complete CPMM-SHIELD flow"
```

---

### Task 10: Full regression, smoke verification, and PR readiness

**Files:**
- Modify tests only if failures reveal incorrect expectations; do not weaken security assertions to make tests pass.
- No new product features in this task.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified branch suitable for PR review.

- [ ] **Step 1: Run the full unit/integration suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript build**

```bash
pnpm build
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 3: Run structural smoke**

```bash
pnpm smoke
```

Expected:

- `/health` succeeds
- trusted registry is reachable
- malformed request fails before payment
- valid request receives official 402 challenge
- replay reservation behavior is exercised
- output explicitly says no funds moved in structural mode

- [ ] **Step 4: Run simulator**

```bash
pnpm simulate
```

Expected: deterministic simulation passes and remains visibly labeled `SIMULATION — NO REAL FUNDS`.

- [ ] **Step 5: Run x402 inspection/checklist**

```bash
pnpm x402 inspect
pnpm x402 checklist
```

Expected: protected route, network/asset/payTo configuration, discovery metadata, and environment readiness are reported without secrets.

- [ ] **Step 6: Run deterministic client path where environment allows**

```bash
pnpm demo:scripted
```

If no funded payer/treasury exists, record that the deterministic no-funds validation is complete and do not claim live settlement.

- [ ] **Step 7: Run live TestNet acceptance only when disposable funded credentials are present**

```bash
LIVE_X402=true pnpm smoke
```

Expected when credentials are configured:

- upstream TestNet USDC settlement confirmed
- treasury pays each configured resource
- each downstream settlement receipt confirmed
- signed receipt verifies
- replay of captured proof against a different job returns HTTP 409

If credentials are absent, do not fabricate a live-success claim.

- [ ] **Step 8: Review diff for secret leakage and accidental scope growth**

Check:

```bash
git diff main...HEAD -- . ':!pnpm-lock.yaml'
git grep -n -E 'mnemonic|privateKey|OPENAI_API_KEY' -- ':!*.md' ':!.env.example'
```

Expected: no secrets, only variable names/documentation and redaction logic.

- [ ] **Step 9: Final commit if verification required test/doc fixes**

```bash
git add -A
git commit -m "test: verify complete CPMM-SHIELD flow"
```

Skip the commit if the working tree is already clean.

- [ ] **Step 10: Open PR**

PR title:

```text
feat: complete CPMM-SHIELD trusted x402 orchestration
```

PR body must summarize:

```text
- secure client request contract
- trusted owned/external provider registry
- provider-specific input adapters
- preserved settlement-first upstream flow
- isolated treasury downstream x402 payments
- response firewall and signed receipts
- bounded OpenAI commerce tool
- VibeKit/Algorand agent guidance
- judge-facing dashboard and docs
- verification results, clearly separating structural vs live TestNet evidence
```

---

## Self-Review Results

### Spec coverage

Covered:

- VibeKit as development layer: Task 8
- secure request contract: Task 1
- authoritative trusted registry: Task 2
- external-provider-capable request mapping: Task 3
- server response-schema authority and required semantics: Task 4
- settlement-first x402/Bazaar metadata: Task 5
- bounded AI agent: Task 6
- judge-facing dashboard: Task 7
- organizer resources/agent docs: Task 8
- README/project boundaries: Task 9
- complete verification and live-TestNet honesty: Task 10

Deferred production storage/KMS/DNS/reputation items remain explicit non-goals in the approved spec and are not accidentally introduced here.

### Placeholder scan

No TBD/TODO/"implement later" steps are present. Each code-bearing task defines concrete interfaces, test expectations, commands, and commit boundaries.

### Type consistency

The plan consistently uses:

```ts
RequestedResource = {
  id: string;
  input: Record<string, unknown>;
  maxPayment: number;
  required: boolean;
}

ResourceDefinition = {
  id;
  name;
  origin;
  method;
  path;
  priceAtomic;
  maxPriceAtomic?;
  inputSchema;
  responseSchema;
  trust;
  description;
  tags;
  timeoutMs?;
  maxResponseBytes?;
}
```

`definition.responseSchema` is the only downstream response schema authority, and `buildProviderRequest()` is the only new provider request mapping interface referenced by later tasks.
