# CPMM-SHIELD Security Model

This document separates implemented hackathon controls from production aspirations. The three owned APIs return deterministic simulated content; live mode can use real Algorand TestNet x402 settlement.

| Defense | Current implementation | Remaining limitation |
| --- | --- | --- |
| Settle-before-action | The custom x402/Hono boundary verifies the advertised requirements, blocks on facilitator settlement, records the upstream transaction, and only then invokes orchestration. | External facilitator behavior is outside this repository; live proof requires funded TestNet credentials. |
| Quote binding and replay defense | HMAC binds route, job ID, quoted atomic price, and expiry. The stable request hash binds resource IDs/inputs. A payment-proof fingerprint is reserved and cannot be rebound to another job. | Reservations are process-local and do not survive restart or coordinate across replicas. |
| Trusted provider boundary | Public requests contain only resource ID, input, maxPayment, and required flag. URL/method/schemas/pricing/trust come from the server registry. External curated origins must use HTTPS and literal private-network hosts are rejected. | DNS rebinding/post-resolution IP validation and centralized egress policy are not implemented. Production should resolve and pin/validate outbound destinations. |
| Discovery vs authorization | Bazaar metadata can be used for discovery, but treasury spending requires an explicitly curated `ResourceDefinition`. | No provider-reputation or automated approval workflow yet. |
| Provider input validation | Exact server-owned provider input schemas reject unknown/missing/wrong-type/empty/oversized fields before a 402 is emitted. | Current schema model intentionally supports a small flat primitive subset needed by the demo. |
| Spending controls | Resource count, duplicate IDs, per-resource limits, trusted prices/price ceilings, and total job limits run before payment. | No durable treasury balance reservation across concurrent jobs. |
| Wallet isolation | Browser/AI receives no secret. Upstream client and downstream treasury are separate roles. Audit redaction covers credential-like fields. | Environment mnemonics are appropriate only for disposable TestNet custody. Production needs KMS/HSM or equivalent signer isolation. |
| Downstream settlement | Treasury requests use x402 and a resource is not treated as successfully paid without a successful settlement receipt and transaction ID. | Provider/facilitator availability remains external dependency risk. |
| Response firewall | Redirect rejection, HTTP status, settlement confirmation, JSON content type, declared/actual byte limits, exact response schema, primitive bounds, extra-field rejection, and narrow blocked instruction markers gate aggregation. | This is intentionally not a general malicious-content/prompt-injection classifier. |
| Settled-but-invalid accounting | If a provider payment settled but its response is invalid, the spent amount remains visible and the result is rejected from aggregation. | No automated refund/dispute protocol. |
| Idempotency | A request ID is bound to a stable request hash, only one processing claim succeeds, and terminal receipts are cached. | In-memory single-process state only. |
| Receipt integrity | Canonical receipt JSON is Ed25519-signed and `verifyReceipt` detects modification. | No receipt-key rotation or public-key discovery policy. |
| Audit privacy | Bounded structured events omit payment proofs and recursively redact credential-like keys. | Production audit storage, retention, access control, and tamper evidence are not included. |

## Secret handling

- Never commit `.env`, mnemonic phrases, private keys, payment proofs, or API keys.
- Use disposable separately funded TestNet accounts for `CLIENT_MNEMONIC` and `TREASURY_MNEMONIC`.
- `PAY_TO_ADDRESS` is a public receiver address and must not contain private signing material.
- Keep `DEMO_MODE` disabled unless intentionally running the disposable TestNet server-side payer.
- `DEMO_MODE=true` is forbidden on Mainnet by configuration validation.
- Treat logs, CI output, deployment dashboards, and screenshots as potentially sensitive operational surfaces.
- VibeKit/AI coding tools must never be given wallet mnemonics in prompts; VibeKit is development guidance, not signer custody for this runtime.

## External provider curation

External providers belong in `src/shield/trusted-providers.ts` only after explicit review. At minimum verify:

1. the HTTPS origin/path and operator;
2. the expected x402 network/asset behavior;
3. expected/maximum price;
4. exact provider input contract;
5. exact response contract;
6. timeout and response-size expectations;
7. whether the output is safe/useful for the agent workflow.

Do not add a Bazaar-discovered URL directly to the treasury path from user/model input.

## Reporting

Do not include secrets or reusable signed payment proofs in security reports. Provide the affected route/provider, expected and actual behavior, transaction IDs only when safe/public, and a minimal sanitized reproduction.
