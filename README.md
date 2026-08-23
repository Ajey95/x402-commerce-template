# CPMM-SHIELD

**One payment in. Many protected resources out.**

CPMM-SHIELD is a settlement-first x402 payment firewall and orchestrator for AI agents on Algorand. A client makes one bounded upstream USDC payment; the shield confirms settlement, pays only server-trusted downstream x402 resources from a separate treasury, validates every response, and returns one Ed25519-signed, auditable receipt.

Built for the x402 Global Challenge as an **Orchestrator entry**, on top of the organizer-provided x402 commerce starter.

## Why it exists

A multi-tool AI agent can otherwise expose its wallet to every provider, accept several independent payment challenges, and trust every successful HTTP response. CPMM-SHIELD narrows that surface:

- the client wallet touches only the shield;
- the AI selects trusted resource IDs, not arbitrary payment destinations;
- provider URLs, methods, schemas, networks, assets, and recipients are server controlled;
- provider input and budgets are enforced before a payment challenge;
- orchestration starts only after confirmed upstream settlement;
- downstream payments use an isolated treasury signer;
- downstream settlement receipts are mandatory;
- JSON/content type/size/exact-schema/injection-marker checks gate results;
- replayed payment proofs and changed duplicate request IDs are rejected;
- the final signed receipt makes payment and validation outcomes machine-verifiable.

The built-in weather, company, and sentiment payloads are **SIMULATED CONTENT**. The deterministic three-item flow uses weather and company lookup plus one independently hosted provider selected by network. The dashboard labels owned simulation separately from **PROVIDER CONTENT** and labels a live configured TestNet payment path **REAL TESTNET PAYMENT**.

## Architecture

```text
AI agent / browser / CLI
          |
          | trusted resource IDs + bounded inputs
          v
+----------------------------------+
| CPMM-SHIELD                      |
| parse + provider-input policy    |
| budgets + quote binding + replay |
+----------------+-----------------+
                 |
              HTTP 402
                 |
         client signs/retries
                 |
                 v
+----------------------------------+
| x402 / GoPlausible               |
| verify + Algorand settlement     |
+----------------+-----------------+
                 |
         settlement confirmed
                 |
                 v
+----------------------------------+
| isolated treasury                |
+-------+------------+-------------+
        |            |
        v            v
  trusted x402   trusted x402 ...
   provider A     provider B
        |            |
        +------v-----+
               |
+----------------------------------+
| Response firewall                |
| settlement + JSON + size         |
| exact schema + content markers   |
+----------------+-----------------+
                 |
                 v
       Ed25519 signed receipt
```

The runtime uses the official `@x402` core/Hono/fetch/AVM packages, Exact AVM scheme, GoPlausible facilitator, Algorand SDK, and Algorand USDC payment requirements.

## Trust model

CPMM-SHIELD separates **discovery** from **authorization**.

| Provider type | Meaning |
| --- | --- |
| `owned-demo` | x402 route hosted by CPMM-SHIELD; deterministic demo content |
| `external-curated` | independently hosted x402 provider explicitly reviewed and added to the trusted registry |
| Bazaar candidate | discoverable metadata only; **never automatically trusted or paid** |

The authoritative provider definition owns the origin, path, method, price, input schema, response schema, timeout, size limit, description, tags, and trust mode. The public request cannot override these controls.

Only one curated external provider is active at a time:

| Network | Active provider | Contract | Pinned price |
| --- | --- | --- | ---: |
| TestNet | `external-algo-price` at `https://recourse-api-production.up.railway.app/feed/compliant` | `GET`, exact `{}` input, signed ALGO/USD price response | 0.001000 USDC |
| MainNet | `external-hash` at `https://agent402.tools/api/hash` | `POST`, exact `{ text, algo }` input, deterministic hash response | 0.001000 USDC |

The other network's external provider ID is absent from the registry and rejected before any payment challenge. Every curated definition pins its own Algorand recipient, while treasury policy also pins the runtime network, USDC ASA, and exact amount before signing.

## Payment flow

1. `POST /api/shield/execute` parses strict JSON and accepts only resource ID, provider-specific input, caller payment ceiling, and required flag.
2. The trusted registry resolves the provider and validates input, resource count, duplicate IDs, per-resource limits, and total job budget.
3. The server creates an expiring HMAC-bound job quote and returns HTTP 402 with a dynamic x402 price.
4. The client signs the advertised payment requirement and retries.
5. The shield verifies the payment requirement and rejects mismatched amount/network/asset/payTo or reused payment proof.
6. The shield **blocks on facilitator settlement** and stores the upstream transaction before business logic begins.
7. A separate treasury payer builds requests only from trusted provider definitions and calls each x402 endpoint.
8. Every downstream response must include confirmed settlement and pass redirect/status/content-type/size/JSON/schema/content checks.
9. The shield returns an Ed25519-signed aggregate receipt and caches it by request ID.

**Paid does not mean trusted. Settled plus validated means usable.**

## Judge quick start

Structural, no-funds verification:

```bash
pnpm install
pnpm smoke
```

The structural smoke initializes the app, verifies the four-resource active registry, checks that the deterministic job requests exactly three resources, obtains an official 0.007000-USDC dynamic-price HTTP 402 on TestNet, proves malformed input is rejected before payment, and checks replay reservation. It explicitly prints that no funds moved.

Full live TestNet acceptance, with a running configured service and funded disposable client/treasury wallets:

```bash
LIVE_X402=true pnpm smoke
```

PowerShell:

```powershell
$env:LIVE_X402='true'; pnpm smoke
```

When configured with funded disposable TestNet credentials, live mode attempts the three-item flow of two owned resources plus `external-algo-price`, requires settlement evidence for every paid boundary, verifies the aggregate signature, captures the payment proof, and confirms replay against a different job returns HTTP 409. This documentation is not evidence that a live run has succeeded.

## Local setup

Requirements: Node 20+, pnpm 10+, disposable Algorand TestNet accounts, ALGO for fees/minimum balances, and TestNet USDC opt-in/funding.

```bash
pnpm install
# Copy .env.example to .env using your shell
pnpm dev
```

Wallet roles:

- `PAY_TO_ADDRESS` — public address receiving the one upstream shield payment.
- `CLIENT_MNEMONIC` — disposable buyer used only by CLI/demo flows.
- `TREASURY_MNEMONIC` — disposable TestNet payer for downstream providers and receipt signing.

Never reuse a production wallet, commit `.env`, log mnemonics, or enable `DEMO_MODE` on Mainnet.

Open `http://localhost:3000` for the operations dashboard. With `DEMO_MODE=false`, the browser safely produces an unpaid quote only. With `DEMO_MODE=true` and both disposable TestNet mnemonics configured, the browser can invoke the server-side TestNet demo payer.

## Clients

Deterministic three-resource flow:

```bash
pnpm demo:scripted
```

OpenAI tool-calling flow:

```bash
pnpm client:shield "Get Bangalore weather, look up Algorand Foundation, and fetch the signed external ALGO/USD price."
```

The OpenAI client exposes exactly one bounded `requestShieldJob` commerce tool. The model may choose only listed trusted resource IDs and bounded provider inputs. It cannot choose provider URLs, recipients, network, asset, schemas, or treasury credentials. The confirmed signed receipt is fed back to the Responses API, and the model is instructed to summarize only validated receipt results.

`OPENAI_MODEL` defaults to `gpt-5.6`; when unavailable to the configured API project, the client chooses the newest compatible model exposed by that project's Models API.

## API

### `POST /api/shield/execute` — x402 protected

Secure request contract:

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

Clients **never** submit provider URLs, response schemas, recipient addresses, networks, or assets. These are trusted server-side configuration.

Monetary fields are atomic USDC units with six decimals. The TestNet deterministic request uses ceilings equal to current trusted prices: weather 2000, company lookup 3000, and external ALGO price 1000 atomic units. With the 1000-atomic service fee, the quote is 7000 atomic USDC, or `0.007000`.

Unpaid response: HTTP 402, `PAYMENT-REQUIRED` header, plus a JSON quote containing job ID, price, binding, and expiry.

Example paid response:

```json
{
  "jobId": "job_123",
  "status": "COMPLETED",
  "summary": { "requested": 3, "completed": 3, "failed": 0, "rejections": 0 },
  "payments": {
    "upfront": "0.007000",
    "downstream": "0.006000",
    "serviceFee": "0.001000",
    "remaining": "0.000000"
  },
  "resources": [],
  "results": {},
  "settlementTxnId": "...",
  "receiptPublicKey": "...",
  "signature": "...",
  "generatedAt": "..."
}
```

### Public operational endpoints

| Route | Purpose |
| --- | --- |
| `GET /health` | network/facilitator/treasury/challenge readiness and receipt public key |
| `GET /api/shield/resources` | safe trusted-provider metadata and input schemas |
| `GET /api/shield/jobs/:jobId` | pending job metadata or terminal signed receipt |
| `GET /api/shield/audit?jobId=...` | redacted bounded audit events |

### Owned paid demo resources

| Route | Price | Content |
| --- | ---: | --- |
| `GET /api/resources/weather?city=X` | 0.002000 USDC | deterministic simulated weather |
| `GET /api/resources/company-lookup?name=X` | 0.003000 USDC | deterministic simulated company record |
| `POST /api/resources/sentiment-score` | 0.002000 USDC | deterministic sentiment score |

The legacy `GET /api/wallet/:address` paid example remains for compatibility but is not the primary product.

### Curated external resources

`ALGORAND_NETWORK=testnet` exposes only `external-algo-price`; `ALGORAND_NETWORK=mainnet` exposes only `external-hash`. Both are independently hosted and labeled `external-curated` / `PROVIDER CONTENT`. They are not owned demo routes and are never described as simulated content.

## Adding a curated external x402 provider

Add an explicit `ResourceDefinition` to a curated registry configuration and pass it to `createResourceRegistry(...)` / `createApp({ registry })`. A definition must include trusted origin/path/method/pricing, exact input and response schemas, trust mode, and metadata.

Do not take a provider URL directly from an AI-generated request and do not automatically trust a Bazaar discovery result.

MainNet activation remains gated on a production-safe signer, deliberately funded MainNet accounts, correct USDC opt-ins, and independently verified real settlement evidence. `DEMO_MODE` remains prohibited on MainNet, and structural tests or unpaid HTTP 402 checks are not settlement evidence.

See:

- `src/shield/registry.ts`
- `src/shield/provider-request.ts`
- `AGENTS.md`
- `skills/cpmm-shield-x402/SKILL.md`

## VibeKit / coding-agent setup

VibeKit is optional **development tooling**, not runtime payment middleware. It helps coding agents use current Algorand skills/MCP guidance. When available:

```bash
vibekit init
vibekit status
```

Use the canonical Algorand `algorand-x402-typescript` skill for current AVM/x402 patterns and merge it with the stricter project-specific rules in `AGENTS.md`. Never let generated setup overwrite repository invariants.

See `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` and `docs/resources/HACKCULTURE_RESOURCES.md`.

## Environment reference

| Variable | Required | Default / purpose |
| --- | --- | --- |
| `PORT` | no | `3000` |
| `API_BASE_URL` | deploy | public origin used for shield and owned-resource metadata |
| `ALGORAND_NETWORK` | no | `testnet`; `mainnet` recognized |
| `FACILITATOR_URL` | no | `https://facilitator.goplausible.xyz` |
| `PAY_TO_ADDRESS` | yes | public upstream USDC receiver |
| `PRICE_USDC` | no | `0.001` service fee |
| `CLIENT_MNEMONIC` | live client/demo | disposable TestNet buyer |
| `TREASURY_MNEMONIC` | live orchestration | disposable TestNet downstream payer and receipt signer |
| `WALLET_ADDRESS` | legacy demo | default legacy wallet lookup |
| `INDEXER_URL` | no | AlgoNode network default |
| `DEMO_MODE` | no | `false`; server-side TestNet buyer |
| `CHALLENGE_MODE` | no | `false`; adds `x402-global-challenge` payment metadata when enabled |
| `SHIELD_MAX_JOB_SPEND` | no | `20000` atomic |
| `SHIELD_MAX_RESOURCE_PAYMENT` | no | `10000` atomic |
| `SHIELD_MAX_RESOURCES` | no | `3` |
| `SHIELD_REQUEST_TIMEOUT_MS` | no | `8000` |
| `SHIELD_MAX_RESPONSE_BYTES` | no | `64000` |
| `QUOTE_EXPIRY_SECONDS` | no | `120` |
| `OPENAI_API_KEY` | agent only | Responses/Models API |
| `OPENAI_MODEL` | agent only | `gpt-5.6` with live availability fallback |
| `LIVE_X402` | smoke only | `true` enables real paid acceptance |

## Verification

```bash
pnpm build
pnpm test
pnpm smoke
pnpm simulate
pnpm x402 inspect
pnpm x402 checklist
```

The simulator is labeled **SIMULATION — NO REAL FUNDS**. The default smoke never claims blockchain settlement. Unit/integration tests use deterministic boundary doubles for failure cases. Only a successful `LIVE_X402=true pnpm smoke` against configured funded disposable TestNet accounts constitutes this project's live TestNet acceptance evidence.

## Security model and production gaps

See `SECURITY.md` for the control-by-control status. Important limitations remain intentionally explicit:

- jobs, audit events, quote bindings, and replay reservations are process-local memory;
- environment mnemonic custody is suitable only for disposable TestNet wallets;
- balance reservation across concurrent jobs is not durable;
- response validation uses exact schemas and narrow instruction markers, not a general prompt-injection solution;
- a multi-replica deployment requires atomic shared persistence;
- external provider trust is curated configuration, not a decentralized reputation system;
- controlled DNS/IP egress and pinning are not yet implemented.

A production successor should move signers to KMS/HSM custody, use durable transactional storage with unique proof/request constraints and balance reservations, add controlled egress policy, centralize protected audit storage, and implement receipt-key rotation/discovery.

## Deployment

The included `Dockerfile` and `render.yaml` run a persistent Node service. Do not deploy the settle-wait flow as a short-lived serverless function.

For Render:

1. Create a Blueprint from this repository.
2. Set `API_BASE_URL` to the public HTTPS origin.
3. Add `PAY_TO_ADDRESS`, disposable TestNet `CLIENT_MNEMONIC`, `TREASURY_MNEMONIC`, and optionally `OPENAI_API_KEY` in secret configuration.
4. Keep `DEMO_MODE=true` only for an intentionally funded TestNet judge demo.
5. Deploy, run the live TestNet smoke when funded, then verify the shield endpoint through the GoPlausible dashboard/resource catalog and an Algorand explorer.

Never place secrets in `render.yaml` or source control.

## Further work

Durable SQL/Redis storage, per-job treasury balance reservations, KMS/HSM signer abstraction, broader curated provider integrations, DNS/IP egress enforcement, receipt-key rotation/discovery, provider reputation, and adversarial validation evaluation.

## References

The exact HackCulture resource set is preserved in `docs/resources/HACKCULTURE_RESOURCES.md`.
