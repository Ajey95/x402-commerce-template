# CPMM-SHIELD Design

## Product

CPMM-SHIELD extends this repository's working Algorand x402 v2 template into a payment orchestrator: one client payment funds a policy-checked job, an isolated treasury pays selected downstream x402 resources, every response is validated, and a signed receipt plus audit trail is returned.

The visible product follows [the dashboard concept](../../design/cpmm-shield-dashboard-concept.png) and the tagline “One payment in. Many protected resources out.”

## Existing lifecycle retained

The build keeps Hono, `@x402/hono`, `@x402/core`, `@x402/avm`, `@x402/fetch`, GoPlausible, TestNet USDC, Bazaar metadata, and the existing paying-client helper. Dynamic route pricing derives the upstream charge from the validated request body.

The stock middleware verifies before the handler and settles afterward. CPMM-SHIELD must not spend treasury funds in that gap, so the protected shield route uses a small Hono adapter around the official `x402HTTPResourceServer` methods: process the official HTTP payment request, settle the verified payment synchronously, attach the official settlement response headers, and only then call the orchestrator handler. Downstream demo resources keep the stock middleware because their handlers have no paid side effects.

## Modules

- `registry.ts`: three owned resources, fixed limits, methods, schemas, and local URLs.
- `policy.ts`: resource count, amount, allowlist, duplicate, URL, redirect, timeout, response-size, and SSRF decisions.
- `jobs.ts`: in-memory job state, idempotency, atomic processing claims, consumed payment fingerprints, and completed receipts.
- `binding.ts`: HMAC quote token covering route, job ID, atomic quoted price, and expiry.
- `audit.ts`: secret-free event ring buffer exposed to the dashboard API.
- `payment-manager.ts`: dynamic quote calculation and settlement-first official x402 transport adapter.
- `resource-client.ts`: treasury-funded `@x402/fetch` client, settlement receipt checks, timeout, redirect denial, and bounded response reads.
- `validator.ts`: strict JSON schema allowlist and recursive prompt-injection marker checks.
- `orchestrator.ts`: sequential deterministic resource execution, partial failure, accounting, aggregation, and receipt signing.

## Payment and replay model

An unpaid valid `POST /api/shield/execute` creates or returns a quote and emits an official `PAYMENT-REQUIRED` response. The custom response body also contains the job ID, expiry, and server-signed quote binding. A paid retry must have identical request details, a valid unexpired binding, an unused payment proof, and exact SDK-verified payment requirements. The proof fingerprint is claimed before settlement; a failed settlement releases the claim, while a successful settlement permanently consumes it. Handler execution occurs only after settlement succeeds. Repeating the same completed request ID returns the cached receipt without another downstream payment.

## Downstream and validation

Weather, company lookup, and sentiment resources are deterministic content behind real x402 routes. The treasury client pays through the existing AVM client abstraction using `TREASURY_MNEMONIC`; it never receives client key material. Each response must be successful JSON under the size limit and match an exact per-resource schema with no extra fields, wrong types, oversized strings, or blocked prompt-injection markers.

## Receipt and UI

The receipt contains accounting, per-resource settlement/validation outcomes, aggregated results, rejection count, and audit events. It is signed with Ed25519 using the treasury wallet in TestNet demo mode. The dashboard is server-rendered HTML/CSS/JS with one orchestration frame, live flow nodes, accounting band, validated results, audit table, and explicit “REAL TESTNET PAYMENT” versus “SIMULATED CONTENT” labels.

## Verification boundary

Unit/integration tests are deterministic and use fake facilitator/treasury boundaries. Live TestNet acceptance additionally requires funded, USDC-opted-in client, treasury, and receiver wallets plus network access. The repository never fabricates transaction IDs; simulation uses clearly prefixed simulation IDs and is never presented as settlement proof.

