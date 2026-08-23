# CPMM-SHIELD Complete Architecture Design

Date: 2026-08-23
Status: Approved architecture, implementation pending
Branch: `feat/cpmm-shield-complete`

## 1. Goal

Build CPMM-SHIELD into a complete hackathon-grade x402 payment firewall and orchestrator for AI agents on Algorand.

The product promise is:

> One payment in. Many protected resources out.

A client or AI agent makes one upstream x402 USDC payment to CPMM-SHIELD. The shield validates the requested work before payment, creates a bounded quote, waits for confirmed facilitator settlement, then uses an isolated treasury wallet to pay one or more allowlisted downstream x402 resources. Each downstream response is independently checked before aggregation. The final result is returned with an Ed25519-signed execution receipt and redacted audit trail.

The implementation must preserve the existing working settlement-first architecture and extend it rather than replace it.

## 2. Official guidance and operating assumptions

The implementation follows the resources provided in the HackCulture x402 Global Challenge PreHack Resources tab:

- x402 Documentation: `https://docs.x402.org/introduction`
- x402 on Algorand Developer Guide: `https://dev.algorand.co/resources/x402-on-algorand/`
- x402 GitHub: `https://github.com/coinbase/x402`
- x402 Kit: `https://x402-kit-kappa.vercel.app/`
- Pera Wallet: `https://pera.app/`
- AlgoKit: `https://algorand.co/algokit`
- VibeKit: `https://www.getvibekit.ai/`
- Algorand Developer Portal: `https://dev.algorand.co/`
- Organizer-provided x402 starter template
- GoPlausible facilitator dashboard and resource catalog
- Lora/Pera explorers and the Algorand technical cheatsheet

The Algorand developer guide defines the expected payment lifecycle as: an unpaid client request receives HTTP 402, the client signs and retries with payment proof, the resource server delegates verification/settlement to a facilitator, and protected business logic runs only after payment is confirmed.

The repository already uses the official x402 AVM stack and GoPlausible facilitator. This design keeps that runtime model.

## 3. VibeKit role

VibeKit is a development and agent-knowledge layer, not a runtime dependency in the payment path.

The repo will be configured so coding agents understand and follow:

- Algorand account and asset safety
- TypeScript x402 client/server patterns
- AVM Exact payment scheme usage
- facilitator responsibilities
- Bazaar discovery metadata
- TestNet/Mainnet distinctions
- secure mnemonic handling
- CPMM-SHIELD settlement-first invariants

The canonical Algorand Agent Skills collection includes an `algorand-x402-typescript` skill. The repository will merge VibeKit/Algorand guidance with the existing `AGENTS.md`; existing project-specific rules must never be overwritten.

Runtime request handling, settlement, treasury payment, and receipt generation continue to use the official `@x402/*` packages already present.

## 4. Core invariants

The following rules are non-negotiable:

1. Invalid input is rejected before x402 middleware, so malformed requests are never charged.
2. A valid unpaid request returns an official HTTP 402 challenge.
3. The upstream payment must be verified and settled before orchestration begins.
4. The client wallet never pays arbitrary downstream providers directly.
5. The treasury signer is isolated from the client signer.
6. The AI model cannot choose arbitrary destination addresses, assets, networks, schemas, or payment recipients.
7. Replayed payment proofs are rejected.
8. Duplicate request IDs are idempotent or rejected according to job state.
9. A downstream HTTP 200 alone is not trusted; downstream settlement and response validation are both required.
10. Secrets, mnemonics, private keys, API keys, and funded-wallet credentials are never logged or committed.
11. Demo resources must remain clearly labeled `SIMULATED CONTENT / REAL TESTNET PAYMENT` when applicable.
12. Mainnet deployment must never enable server-side demo payer mode.

## 5. Target architecture

```text
AI agent / browser / CLI
          |
          | POST /api/shield/execute
          v
+------------------------------------+
| CPMM-SHIELD request boundary       |
| parse + schema + resource IDs      |
| input validation + idempotency     |
+----------------+-------------------+
                 |
                 v
+------------------------------------+
| Policy + Quote Engine              |
| trusted provider lookup            |
| payment ceilings                   |
| max job spend                      |
| HMAC-bound expiring quote          |
+----------------+-------------------+
                 |
             HTTP 402
                 |
         client signs/retries
                 |
                 v
+------------------------------------+
| GoPlausible / x402 settlement      |
| verify payment requirements        |
| reserve proof against job          |
| settle on Algorand                 |
+----------------+-------------------+
                 |
        settlement confirmed
                 |
                 v
+------------------------------------+
| Shield Orchestrator                |
| isolated treasury x402 payer       |
+--------+------------+--------------+
         |            |
         v            v
   Provider A      Provider B ...
         |            |
         +------v-----+
                |
+------------------------------------+
| Response Firewall                  |
| HTTP status / no redirects         |
| x402 settlement receipt            |
| JSON content type                  |
| byte limit                         |
| exact schema                       |
| provider-specific validation       |
| narrow injection markers           |
+----------------+-------------------+
                 |
                 v
+------------------------------------+
| Aggregate + Ed25519 receipt        |
| per-provider transaction outcome   |
| spend summary / partial failures   |
| receipt public key + signature     |
+------------------------------------+
```

## 6. Request contract

The current request gives the client too much control by accepting provider URLs and expected schemas. The new public contract moves security-sensitive configuration to the server.

Target request:

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

Client-controlled fields:

- `requestId`
- trusted resource `id`
- provider-specific bounded `input`
- `maxPayment`
- `required`

Server-controlled fields:

- URL/origin/path
- HTTP method
- expected network and asset
- receiver/pay-to behavior as exposed by x402
- canonical price or price ceiling
- request schema
- response schema
- timeout
- maximum response size
- trust mode
- tags and metadata

This prevents an AI agent from inventing arbitrary destinations or weakening its own validation rules.

## 7. Trusted provider registry

Replace the current same-origin-only assumption with a registry that can represent both built-in demo resources and curated external x402 providers.

A provider definition should include at minimum:

```ts
interface ResourceDefinition {
  id: string;
  name: string;
  origin: string;
  path: string;
  method: 'GET' | 'POST';
  priceAtomic: number;
  maxPriceAtomic?: number;
  inputSchema: JsonObjectSchema;
  responseSchema: JsonObjectSchema;
  trust: 'owned-demo' | 'external-curated';
  timeoutMs?: number;
  maxResponseBytes?: number;
  description: string;
  tags: string[];
}
```

Built-in providers remain available for deterministic smoke tests:

- weather
- company lookup
- sentiment score

External providers are added only through explicit configuration or curated code. Bazaar-discovered endpoints are candidates, not automatically trusted payees.

## 8. Bazaar discovery model

The system should distinguish discovery from authorization.

```text
GoPlausible Bazaar
      |
      v
candidate resources
      |
      v
metadata inspection / validation
      |
      v
explicit trust decision
      |
      v
TrustedResourceRegistry
```

No automatic treasury payment may be made to a newly discovered resource without an explicit allowlisting step.

The public CPMM-SHIELD route itself must continue publishing accurate Bazaar metadata describing the real orchestration API and output shape.

When `CHALLENGE_MODE=true`, the challenge tag must remain present.

## 9. Provider-specific input adapters

The treasury client currently hardcodes demo arguments. This must be replaced with deterministic provider adapters.

Examples:

```text
weather
  input: { city }
  GET ?city=<encoded>

company-lookup
  input: { name }
  GET ?name=<encoded>

sentiment-score
  input: { text }
  POST { text }
```

Each adapter:

- validates its input before the job is quoted
- only maps known fields
- cannot override the provider URL, payment destination, headers used by x402, or response schema
- rejects unsupported input keys

## 10. Policy and budgeting

Policy runs before payment challenge generation.

Checks include:

- at least one resource
- maximum resource count
- unique resource IDs per job unless explicitly supported
- resource ID exists in trusted registry
- input validates against provider schema
- `maxPayment` is a safe non-negative integer
- requested max does not exceed global per-resource cap
- provider price does not exceed requester cap
- total quoted job price does not exceed global job cap
- request ID is new or safely idempotent

Quote price remains bounded by resource maximums plus service fee.

## 11. Settlement-first upstream flow

The existing middleware behavior is retained:

1. find the prevalidated job bound to the incoming request
2. verify HMAC quote binding and expiry
3. fingerprint incoming payment proof
4. reserve payment proof against the job
5. process x402 request
6. verify amount/network/asset/payTo match the quoted job
7. settle through the facilitator
8. consume proof reservation
9. store settlement transaction ID
10. only then invoke the orchestrator

A reused payment proof against another job returns HTTP 409.

## 12. Treasury and downstream payment flow

The treasury wallet is a separate payer identity.

For each requested trusted resource:

1. build URL/body through provider adapter
2. make x402-enabled request with treasury payer
3. reject redirects
4. require HTTP success
5. require successful downstream settlement receipt and transaction ID
6. enforce content type and size limits
7. parse JSON
8. validate response schema and content
9. record outcome

The orchestrator supports partial failure. A failed non-required provider does not need to destroy already valid results. The final receipt clearly reports `COMPLETED`, `PARTIAL_FAILURE`, or `FAILED`.

Required-resource semantics will be made explicit in tests and documentation.

## 13. Response firewall

A downstream resource is usable only after both payment and content checks succeed.

Required checks:

- redirects rejected
- non-2xx rejected
- successful x402 settlement receipt required
- `application/json` required
- response byte cap enforced against declared and actual length
- valid JSON object required
- exact allowed fields
- all required fields present
- expected primitive types
- finite numbers
- maximum string lengths
- narrow prompt-injection marker detection
- provider-specific validation hooks where necessary

The product message is:

> Paid does not mean trusted. Settled plus validated means usable.

The injection checker remains intentionally narrow and must not be marketed as a general prompt-injection solution.

## 14. Signed aggregate receipt

The signed receipt remains the primary machine-verifiable output.

It contains:

- job ID
- request ID
- terminal status
- requested/completed/failed/rejected counts
- upfront amount
- downstream amount
- service fee
- remaining amount
- per-resource payment and validation outcome
- downstream transaction IDs where available
- validated results only
- upstream settlement transaction ID
- generation timestamp
- receipt public key
- Ed25519 signature

A helper/test must independently verify the signature.

## 15. AI agent behavior

The OpenAI client remains a bounded commerce agent.

The model may:

- interpret the user's goal
- choose from trusted resources exposed to it
- construct provider-specific input
- set payment ceilings inside policy limits
- invoke one shield commerce tool
- summarize only validated receipt results

The model may not:

- select arbitrary URLs
- select arbitrary pay-to addresses
- change network/asset
- override response schemas
- access treasury mnemonic
- bypass policy
- continue from unvalidated provider text

The agent tool should evolve toward:

```ts
requestShieldJob({
  resources: [
    { id: 'weather', input: { city: 'Bangalore' }, maxPayment: 3000 }
  ]
})
```

For the hackathon build, deterministic resource selection is acceptable when needed for reliable judging, but the contract should support agent-selected trusted resources.

## 16. Agent-development documentation

Update/extend:

- `AGENTS.md`
- `skills.md`
- `docs/resources/`

Add a HackCulture resource index and VibeKit integration guide.

The agent instructions should explicitly tell coding agents:

1. read repository-local guidance first
2. use Algorand/x402 agent skills when available
3. preserve settlement-before-execution
4. never expose secrets
5. keep discovery metadata truthful
6. validate malformed input before payment
7. run build/test/smoke verification before claiming completion
8. distinguish simulated data from real payment execution

## 17. Dashboard design

The dashboard should optimize for a judge understanding the system in under one minute.

Sections:

### Service readiness

- network
- facilitator
- treasury ready
- receipt public key
- challenge mode

### Upstream payment

- quote status
- amount
- settlement status
- transaction ID

### Policy

- requested resources
- trusted resources
- spend cap
- replay protection

### Downstream execution

Per resource:

- provider name
- requested input summary
- payment amount
- settlement status
- transaction ID
- validation status
- latency

### Final receipt

- terminal status
- totals
- signature/public key
- copyable receipt JSON

Demo resources remain visibly marked as simulated content.

## 18. Public endpoints

Keep:

- `GET /health`
- `GET /api/shield/resources`
- `GET /api/shield/jobs/:jobId`
- `GET /api/shield/audit?jobId=...`
- `POST /api/shield/execute`

The resources endpoint should expose safe public provider metadata but never secret config or signer details.

Legacy wallet example can remain for compatibility but must not dominate product messaging.

## 19. Storage scope

For the PreHack implementation, process-local storage remains acceptable, but the limitation must remain explicit.

Hackathon scope:

- in-memory jobs
- in-memory replay reservations
- in-memory audit log

Deferred production work:

- Postgres/Redis durability
- unique transactional constraints on request IDs/payment fingerprints
- distributed balance reservations
- KMS/HSM signer abstraction
- multi-replica coordination
- provider reputation
- DNS/IP pinning and controlled egress
- receipt key rotation/discovery

No code or documentation may imply that the in-memory implementation is production-safe.

## 20. Environment and network safety

TestNet remains the default development mode.

Rules:

- `PAY_TO_ADDRESS` is a public receiver address
- `CLIENT_MNEMONIC` is only a disposable client/demo signer
- `TREASURY_MNEMONIC` is only a disposable TestNet treasury during demo development
- `DEMO_MODE=true` is TestNet-only
- Mainnet must never run demo payer mode
- `.env` remains ignored
- `.env.example` documents values without secrets

Mainnet readiness is a deployment mode, not something tests should silently activate.

## 21. Error behavior

Errors must be explicit and stage-aware.

Examples:

- `invalid_request`
- `resource_not_allowed`
- `invalid_resource_input`
- `resource_over_budget`
- `job_over_budget`
- `duplicate_request_id`
- `quote_expired`
- `payment_replay`
- `payment_resource_mismatch`
- `payment_service_unavailable`
- `downstream_timeout`
- `downstream_unavailable`
- `redirect_rejected`
- `settlement_unconfirmed`
- `invalid_content_type`
- `response_too_large`
- `invalid_json`
- `schema_rejected`
- `prompt_injection_marker`

Error messages returned publicly should not expose sensitive provider internals or secrets.

## 22. Testing strategy

The implementation must add/maintain tests for:

### Request and policy

- valid trusted resource accepted
- unknown resource rejected before payment
- invalid provider input rejected before payment
- duplicate resource rejected
- per-resource budget overflow rejected
- total job budget overflow rejected
- client cannot supply/override URL
- client cannot supply/override response schema

### x402 boundary

- valid unpaid request returns 402
- malformed request returns 4xx before 402
- payment requirement matches quoted amount/network/asset/payTo
- payment replay returns 409
- settlement failure prevents orchestration

### Treasury client

- provider-specific input maps correctly
- redirects rejected
- HTTP failure rejected
- settlement receipt required
- invalid content type rejected
- oversized response rejected
- malformed JSON rejected

### Validation

- exact schema accepted
- unexpected fields rejected
- missing fields rejected
- wrong types rejected
- injection marker rejected

### Orchestration and receipt

- all providers complete
- partial failure reported accurately
- downstream settled-but-invalid response still counts spend
- signed receipt verifies
- idempotent terminal receipt retrieval

### Discovery and docs

- Bazaar metadata accurately describes shield endpoint
- challenge tag is present when challenge mode is enabled

## 23. Verification commands

Before implementation is considered complete, run:

```bash
pnpm build
pnpm test
pnpm smoke
pnpm simulate
pnpm x402 inspect
pnpm x402 checklist
```

When funded disposable TestNet credentials are available, also run the real paid acceptance path:

```bash
LIVE_X402=true pnpm smoke
```

The default smoke and simulator must never claim blockchain settlement when they use doubles/simulation.

## 24. Acceptance criteria

The hackathon implementation is complete when:

1. the agent-development layer contains VibeKit/Algorand x402 guidance without replacing repo-specific rules
2. `/api/shield/execute` accepts trusted resource IDs and provider-specific inputs, not arbitrary provider URLs/schemas
3. policy rejects invalid resources/inputs before charging
4. upstream settlement is required before orchestration
5. treasury can pay curated external x402 providers as well as owned demo resources
6. downstream settlement receipts are mandatory
7. response firewall gates aggregation
8. final receipt is signed and independently verifiable
9. replay protection remains enforced
10. Bazaar metadata is accurate
11. dashboard visibly explains the payment and validation lifecycle
12. demo content is honestly labeled
13. tests cover security boundaries and partial failures
14. documented verification commands pass in the available environment
15. real TestNet acceptance is documented and can run when funded disposable credentials are supplied

## 25. Explicit non-goals for this iteration

Do not add these unless they become necessary to satisfy acceptance criteria:

- new smart contracts
- runtime dependence on VibeKit
- framework rewrite away from Hono
- mandatory Pera UI integration
- mandatory AlgoKit project restructure
- durable SQL/Redis
- KMS/HSM custody
- fully autonomous trust of Bazaar-discovered providers
- general-purpose prompt-injection detection
- Mainnet demo payer

These are intentionally deferred to keep the implementation focused, verifiable, and safe for the PreHack.