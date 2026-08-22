# CPMM-SHIELD Security Model

This document distinguishes implemented controls from production aspirations. The three owned APIs return simulated content; live mode uses real Algorand TestNet x402 settlement.

| Defense | Status | What is implemented | Remaining limitation |
| --- | --- | --- | --- |
| Settle-before-action race defense | **Hardened & tested** | The custom Hono adapter calls the official x402 verify flow, blocks on processSettlement, records the transaction, and only then invokes orchestration. | External facilitator behavior is outside this repository; live verification requires funded TestNet credentials. |
| Quote binding and replay defense | **Hardened & tested** | HMAC binds resource path, job ID, quoted atomic price, and expiry. A payment-proof fingerprint is atomically reserved and cannot be rebound to another job. | Reservations are process-local and do not survive restart or coordinate across replicas. Production requires a durable unique constraint/transaction. |
| Response validation | **Hardened & tested** | JSON/content-type/size checks, exact trusted schemas, type and string bounds, extra-field rejection, and explicit injection-marker rejection. | This is deliberately narrow and is not a general malicious-content classifier. |
| Wallet isolation | **Implemented, not adversarially tested** | The browser receives no secrets. Client payer and treasury use separate configuration roles. Audit redaction covers secret-looking keys. | Environment mnemonics are TestNet-only custody. Production needs KMS/HSM signing and enforced distinct-account policy. |
| URL and SSRF policy | **Hardened & tested** | Exact configured origin/path allowlist, HTTP(S)-only, private-host rejection outside demo mode, no redirects, timeout, and response-size limit. | DNS rebinding and post-resolution IP checks are not implemented because the registry is exact-origin and fixed; production egress filtering is still recommended. |
| Spending controls | **Hardened & tested** | Count, duplicate, per-resource, declared-max, trusted-price, and total-job limits are enforced before a 402 challenge. | No live treasury balance reservation across concurrent jobs; durable ledger accounting is required for production. |
| Fee/gas attacks | **Implemented, not adversarially tested** | Only registered fixed-price resources can be paid and every response requires confirmed settlement. | Fee ceilings and dynamic on-chain congestion policy are not implemented. |
| Idempotency | **Hardened & tested** | A request ID is bound to a stable request hash, one processing claim is allowed, and terminal receipts are cached. | In-memory storage is single-process only. |
| Receipt integrity | **Hardened & tested** | Canonical JSON is signed with an Algorand Ed25519 key and tampering is detected by verifyReceipt. | Key rotation and public-key discovery policy are not implemented. |
| Audit privacy | **Implemented, not adversarially tested** | Bounded structured events omit full payment headers and recursively redact credential-like fields. | A production audit sink, retention policy, access controls, and tamper evidence are not included. |

## Secret handling

- Never commit .env or any mnemonic.
- Use disposable, separately funded TestNet accounts for CLIENT_MNEMONIC and TREASURY_MNEMONIC.
- PAY_TO_ADDRESS is public and should not contain a key.
- Keep DEMO_MODE disabled unless intentionally running the server-side TestNet payer.
- Treat application logs and deployment dashboards as sensitive operational systems.

## Reporting

Do not include secrets or valid signed payment proofs in a report. Provide the affected route, expected/actual result, and a minimal sanitized reproduction.
