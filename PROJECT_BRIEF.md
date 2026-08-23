# CPMM-SHIELD Project Brief

## Problem

An autonomous agent that buys several paid APIs normally exposes its wallet to every provider, handles several independent payment challenges, and may trust every HTTP 200 as usable tool output. That expands both financial risk and tool-poisoning risk.

## Solution

CPMM-SHIELD is a settlement-first x402 payment firewall and orchestrator. A client pays the shield once. Only after the upstream Algorand settlement is confirmed does the shield use a separate treasury wallet to pay server-trusted downstream x402 resources, validate each settled response, aggregate only usable results, and sign one auditable receipt.

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

The deterministic judge flow uses three independently x402-protected owned demo endpoints:

- weather;
- company lookup;
- sentiment scoring.

Their content is simulated so the demonstration is deterministic. Their x402 middleware and live TestNet payment path use the same official AVM/facilitator integration as the shield.

The architecture can also represent explicitly curated external x402 resources through the trusted `ResourceDefinition` registry without letting users submit arbitrary provider URLs.

## Why Algorand and x402

x402 makes payment negotiation part of ordinary HTTP rather than requiring account creation, API keys, subscriptions, or custom billing flows. Algorand supplies the AVM payment scheme and low-cost settlement rail used by this implementation, and GoPlausible is the configured facilitator for verification/settlement and resource discovery.

CPMM-SHIELD specifically benefits from machine-oriented payments: an AI agent can authorize one bounded purchase while the shield performs policy-controlled downstream machine-to-machine commerce.

## VibeKit / agent-development strategy

VibeKit is used as a coding-agent knowledge and tooling layer, not as runtime payment middleware. Repository agent instructions route Algorand/x402 changes through current canonical `algorand-x402-typescript` guidance when available while preserving stricter CPMM-SHIELD invariants in `AGENTS.md` and `skills/cpmm-shield-x402/SKILL.md`.

This keeps the critical runtime settlement path small and auditable while still giving AI coding agents current Algorand context.

## Honest demo boundary

The three owned resource payloads are deterministic simulated content. Their x402 challenges and configured live TestNet payment path can be real. Unit/integration tests use deterministic boundary doubles and never claim blockchain settlement. The default smoke explicitly says no funds moved.

Only a successful live smoke run with funded disposable TestNet client/treasury accounts constitutes live TestNet acceptance evidence.

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
