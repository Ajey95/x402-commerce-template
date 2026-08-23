# CPMM-SHIELD Project Brief

## Problem

An autonomous agent that buys several paid APIs normally exposes its wallet to every provider, handles several independent payment challenges, and may trust every HTTP 200 as usable tool output. That expands both financial risk and tool-poisoning risk.

## Solution

CPMM-SHIELD is a settlement-first x402 payment firewall and orchestrator. A client pays the shield once. Only after the upstream Algorand settlement is confirmed does the shield use a separate treasury wallet to pay server-trusted downstream x402 resources, validate each settled response, aggregate only usable results, and sign one auditable receipt.

For the x402 Global Challenge, CPMM-SHIELD is classified as an **Orchestrator entry**: one paid shield request coordinates multiple independently protected downstream resources.

**One payment in. Many protected resources out.**

The primary paid route is **POST /api/shield/execute**.

The public request supplies only:

- a unique request ID;
- a trusted resource ID;
- provider-specific bounded input;
- a caller payment ceiling;
- whether the resource is required.

The client and AI model do **not** control provider URLs, response schemas, network, asset, recipient address, treasury signer, or global spending policy.

## Key innovation

- One client payment funds a bounded multi-resource job.
- The client wallet touches only CPMM-SHIELD.
- Provider configuration is server-authoritative, not supplied by the AI.
- Built-in and explicitly curated external x402 providers share one trusted registry abstraction.
- Bazaar discovery is treated as discovery only, never automatic payment authorization.
- Client and treasury wallets are isolated roles.
- Payment proofs are reserved to a job; job quotes bind job ID, price, path, and expiry while the request hash binds provider IDs and inputs.
- Business logic begins after settlement, not after optimistic verification.
- Downstream HTTP success is insufficient: each provider must also produce successful x402 settlement evidence.
- Exact response schemas, content type/size limits, redirect rejection, and narrow injection-marker checks gate aggregation.
- Every payment and validation outcome is visible in an Ed25519-signed aggregate receipt and redacted audit trail.

## Showcase flow

The deterministic judge flow keeps exactly three requests:

- owned weather content;
- owned company lookup content;
- one independently hosted external provider chosen by `ALGORAND_NETWORK`.

On TestNet, the external request is `GET https://recourse-api-production.up.railway.app/feed/compliant` (`external-algo-price`) with exact empty input and a pinned 1000-atomic price/recipient. On MainNet, it is `POST https://agent402.tools/api/hash` (`external-hash`) with exact `{ text, algo }` input and a pinned 1000-atomic price/recipient. The inactive network's ID is not registered.

Owned payloads are deterministic simulated content. External responses are provider content and are never labeled simulated. All downstream calls retain settlement receipt, response firewall, network, asset, amount, and recipient enforcement.

## Why Algorand and x402

x402 makes payment negotiation part of ordinary HTTP rather than requiring account creation, API keys, subscriptions, or custom billing flows. Algorand supplies the AVM payment scheme and low-cost settlement rail used by this implementation, and GoPlausible is the configured facilitator for verification/settlement and resource discovery.

CPMM-SHIELD specifically benefits from machine-oriented payments: an AI agent can authorize one bounded purchase while the shield performs policy-controlled downstream machine-to-machine commerce.

## VibeKit / agent-development strategy

VibeKit is used as a coding-agent knowledge and tooling layer, not as runtime payment middleware. Repository agent instructions route Algorand/x402 changes through current canonical `algorand-x402-typescript` guidance when available while preserving stricter CPMM-SHIELD invariants in `AGENTS.md` and `skills/cpmm-shield-x402/SKILL.md`.

This keeps the critical runtime settlement path small and auditable while still giving AI coding agents current Algorand context.

## Honest demo boundary

The owned resource payloads are deterministic simulated content. Their configured live TestNet payment path can be real, while the selected external result is independently hosted provider content. Unit/integration tests use deterministic boundary doubles and never claim blockchain settlement. The default smoke explicitly says no funds moved.

Only a successful live smoke run with funded disposable TestNet client/treasury accounts constitutes live TestNet acceptance evidence.

MainNet use remains gated on production-safe signer custody, intentionally funded accounts, correct network/USDC configuration, and independently observed real settlement evidence. The presence of the MainNet provider definition or an unpaid 402 is not a MainNet success claim.

## Production posture

This hackathon implementation intentionally uses process-local jobs, quote state, replay reservations, and audit events plus environment-provided disposable TestNet mnemonics.

A production successor needs:

- durable transactional SQL/Redis state and unique replay/idempotency constraints;
- durable per-job treasury balance reservations;
- KMS/HSM or equivalent signer custody;
- multi-replica coordination;
- controlled DNS/IP egress and stronger SSRF protections;
- provider reputation/approval workflows;
- receipt-key rotation/discovery;
- centralized protected audit storage;
- broader adversarial validation evaluation.
