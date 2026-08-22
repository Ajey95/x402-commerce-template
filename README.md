# CPMM-SHIELD

**One payment in. Many protected resources out.**

CPMM-SHIELD is a settlement-first x402 payment orchestrator for AI agents on Algorand. A client makes one upstream USDC payment; the shield confirms settlement, pays allowlisted downstream resources from a separate treasury, validates every response, and returns one signed, auditable receipt.

Built for the x402 Global Challenge, Agentic Solutions track.

## Why it exists

Multi-tool agents otherwise authorize several providers directly and trust every HTTP 200. CPMM-SHIELD narrows that surface:

- the client wallet touches only the shield;
- policy and budgets are enforced before a payment challenge;
- orchestration starts only after confirmed upstream settlement;
- downstream payments use an isolated treasury signer;
- exact schemas and narrow injection markers gate results;
- replayed payment proofs and duplicate request IDs are rejected.

The weather, company, and sentiment payloads are **SIMULATED CONTENT**. Their production payment middleware is the same x402/Algorand path used by the shield and is labeled **REAL TESTNET PAYMENT** in the dashboard.

## Architecture

    AI agent / browser demo
              |
              | one x402 payment
              v
    +-----------------------------+
    | CPMM-SHIELD                 |
    | quote + policy + replay     |
    | settle-wait + orchestration |
    | validation + signed receipt |
    +-------------+---------------+
                  | treasury x402 payments
          +-------+-------+---------+
          v               v         v
       weather         company   sentiment
          +---------------+---------+
                          |
                    validated result

The existing repository integration is preserved: official @x402 core/Hono/fetch packages, Exact AVM scheme, GoPlausible facilitator, and Algorand USDC payment requirements.

## Payment flow

1. POST /api/shield/execute validates JSON, URL allowlist, resource count, duplicate spend, and budgets.
2. The server creates an expiring HMAC-bound job quote and returns HTTP 402 with a dynamic x402 price.
3. The client signs the advertised requirement and retries.
4. The shield verifies and **blocks on facilitator settlement**.
5. A separate treasury payer calls each registered x402 endpoint and requires each settlement receipt.
6. JSON/content type/size/schema/injection checks run.
7. The shield returns an Ed25519-signed aggregate receipt and caches it by request ID.

## Judge quick start

Structural, no-funds verification:

    pnpm install
    pnpm smoke

This starts the application in process, verifies health and registry, obtains an official dynamic-price HTTP 402, proves malformed input is rejected before payment, and checks replay reservation. It clearly prints that no funds moved.

Full live TestNet acceptance, with a running configured service and funded disposable client/treasury wallets:

    LIVE_X402=true pnpm smoke

On PowerShell:

    $env:LIVE_X402='true'; pnpm smoke

Live mode settles the upstream payment, pays and validates all three resources, verifies the signed receipt, then captures the payment proof and confirms replay against a different job returns HTTP 409. No manual wallet popup is required.

## Local setup

Requirements: Node 20+, pnpm 10+, two or three disposable Algorand TestNet accounts, ALGO for fees/minimum balances, and TestNet USDC opt-in/funding.

    pnpm install
    Copy-Item .env.example .env
    pnpm dev

Set PAY_TO_ADDRESS, CLIENT_MNEMONIC, and TREASURY_MNEMONIC in .env. They are separate roles:

- PAY_TO_ADDRESS receives the one upstream shield payment.
- CLIENT_MNEMONIC is the disposable buyer used only by CLI/demo flows.
- TREASURY_MNEMONIC pays downstream providers and signs aggregate receipts.

Never reuse a production wallet or commit .env. Fund/opt in disposable accounts using the current Algorand TestNet dispenser instructions from the Algorand Developer Portal.

Open http://localhost:3000 for the operations dashboard. With DEMO_MODE=false it safely produces real unpaid quotes only. With DEMO_MODE=true and both mnemonics present, the browser can invoke the server-side TestNet demo payer.

## Clients

Deterministic payment flow:

    pnpm demo:scripted

OpenAI tool-calling flow:

    pnpm client:shield "Get Bangalore weather, an Algorand Foundation lookup, and a sentiment score"

The OpenAI client checks the configured model against the live Models API, offers exactly one requestShieldJob tool, executes the same x402 payer, and feeds the confirmed signed receipt back to the Responses API. `OPENAI_MODEL` defaults to `gpt-5.6`; when that model is unavailable to the API project, the client selects the newest compatible model exposed by that project's Models API.

## API

### POST /api/shield/execute — x402 protected

Request:

    {
      "requestId": "job_123",
      "resources": [
        {
          "id": "weather",
          "url": "https://YOUR_HOST/api/resources/weather",
          "maxPayment": 3000,
          "required": true,
          "expectedSchema": {
            "type": "object",
            "required": ["temperature", "condition"]
          }
        }
      ]
    }

The monetary fields are atomic USDC units (six decimals). A three-resource request with maxPayment 3000 each and service fee 1000 quotes 10000 atomic USDC, or 0.010000.

Unpaid response: HTTP 402, PAYMENT-REQUIRED header, plus a JSON quote containing job ID, price, binding, and expiry.

Paid response:

    {
      "jobId": "job_123",
      "status": "COMPLETED",
      "summary": { "requested": 3, "completed": 3, "failed": 0, "rejections": 0 },
      "payments": {
        "upfront": "0.010000",
        "downstream": "0.007000",
        "serviceFee": "0.001000",
        "remaining": "0.002000"
      },
      "resources": [],
      "results": {},
      "settlementTxnId": "...",
      "receiptPublicKey": "...",
      "signature": "...",
      "generatedAt": "..."
    }

### Public operational endpoints

| Route | Purpose |
| --- | --- |
| GET /health | Service/network/treasury readiness and receipt public key |
| GET /api/shield/resources | Trusted resource registry and atomic prices |
| GET /api/shield/jobs/:jobId | Pending job metadata or terminal signed receipt |
| GET /api/shield/audit?jobId=... | Redacted bounded audit events |

### Owned paid resources

| Route | Price | Content |
| --- | ---: | --- |
| GET /api/resources/weather?city=X | 0.002000 USDC | deterministic simulated weather |
| GET /api/resources/company-lookup?name=X | 0.003000 USDC | deterministic simulated company record |
| POST /api/resources/sentiment-score | 0.002000 USDC | deterministic sentiment score |

The legacy GET /api/wallet/:address paid example remains available but is no longer the primary product.

## Environment reference

| Variable | Required | Default / purpose |
| --- | --- | --- |
| PORT | no | 3000 |
| API_BASE_URL | deploy | Public origin used by exact URL policy and metadata |
| ALGORAND_NETWORK | no | testnet; mainnet also recognized |
| FACILITATOR_URL | no | https://facilitator.goplausible.xyz |
| PAY_TO_ADDRESS | yes | Public upstream USDC receiver |
| PRICE_USDC | no | 0.001 service fee |
| CLIENT_MNEMONIC | live client/demo | Disposable TestNet buyer |
| TREASURY_MNEMONIC | live orchestration | Disposable TestNet downstream payer and receipt signer |
| WALLET_ADDRESS | legacy demo | Default legacy wallet lookup |
| INDEXER_URL | no | AlgoNode network default |
| DEMO_MODE | no | false; server-side TestNet buyer |
| CHALLENGE_MODE | no | false; optional legacy Challenge tag |
| SHIELD_MAX_JOB_SPEND | no | 20000 atomic |
| SHIELD_MAX_RESOURCE_PAYMENT | no | 10000 atomic |
| SHIELD_MAX_RESOURCES | no | 3 |
| SHIELD_REQUEST_TIMEOUT_MS | no | 8000 |
| SHIELD_MAX_RESPONSE_BYTES | no | 64000 |
| QUOTE_EXPIRY_SECONDS | no | 120 |
| OPENAI_API_KEY | agent only | Responses/Models API |
| OPENAI_MODEL | agent only | gpt-5.6, with live availability fallback |
| LIVE_X402 | smoke only | true enables real paid acceptance |

## Verification

    pnpm build
    pnpm test
    pnpm smoke
    pnpm simulate
    pnpm x402 inspect
    pnpm x402 checklist

The simulator is labeled **SIMULATION — NO REAL FUNDS**. The default smoke never claims settlement. Unit/integration tests use deterministic boundary doubles for failure cases; only LIVE_X402=true constitutes blockchain acceptance.

## Security model

See [SECURITY.md](SECURITY.md) for control-by-control status and limitations. Important production gaps:

- jobs, audit events, quote bindings, and replay reservations are in memory;
- env mnemonic custody is suitable only for disposable TestNet wallets;
- balance reservation across concurrent jobs is not durable;
- validation is narrow schema enforcement, not a general prompt-injection solution;
- a multi-replica deployment requires atomic shared persistence.

Production should move signers to KMS/HSM custody, use durable transactional storage with unique proof/request constraints, add controlled egress/DNS resolution policy, and centralize protected audit storage.

## Deployment

The included Dockerfile and render.yaml run a persistent Node service. On Render:

1. Create a Blueprint from this repository.
2. Set API_BASE_URL to the public HTTPS origin.
3. Add PAY_TO_ADDRESS, CLIENT_MNEMONIC, TREASURY_MNEMONIC, and optionally OPENAI_API_KEY in the dashboard.
4. Keep DEMO_MODE=true only for the intentionally funded TestNet judge demo.
5. Deploy, run LIVE_X402=true pnpm smoke against the public URL, then register POST /api/shield/execute in the GoPlausible resource catalog.

Do not deploy this settle-wait flow as a short-lived serverless function. Do not place secrets in render.yaml or source control.

## Further work

Durable SQL/Redis storage, per-job treasury balance reservations, signer abstraction for KMS/HSM, provider-specific input payloads, DNS/IP egress enforcement, receipt-key rotation/discovery, and adversarial validation evaluation.

## References

- x402 specification and implementation: https://github.com/x402-foundation/x402
- Algorand x402 guide: https://dev.algorand.co/resources/x402-on-algorand/
- GoPlausible facilitator: https://facilitator.goplausible.xyz
- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses
