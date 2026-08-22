# CPMM-SHIELD Project Brief

## Problem

An autonomous agent that buys several APIs normally exposes its wallet to every provider, handles several payment challenges, and trusts every successful HTTP response. That expands both financial and tool-poisoning risk.

## Solution

CPMM-SHIELD is a settlement-first x402 orchestrator. A client pays the shield once. Only after the upstream Algorand settlement is confirmed does the shield pay allowlisted downstream resources from a separate treasury wallet, validate each response, aggregate the usable results, and sign a receipt.

**One payment in. Many protected resources out.**

The primary paid route is **POST /api/shield/execute**. The showcase flow orchestrates three independently x402-protected endpoints: weather, company lookup, and sentiment scoring.

## Key innovation

- One client payment funds a bounded multi-resource job.
- Client and treasury wallets are isolated roles.
- Payment proofs are reserved to a job; job quotes bind path, ID, price, and expiry.
- Business logic starts after settlement, not after optimistic verification.
- Exact response schemas, size limits, and narrow injection-marker checks gate aggregation.
- Every outcome and payment is visible in a signed receipt and redacted audit trail.

## Why Algorand and x402

x402 makes price discovery and payment authorization part of ordinary HTTP. Algorand provides the AVM payment scheme and TestNet settlement rail used by the existing repository integration. GoPlausible provides the configured facilitator. No performance claim beyond observed transaction receipts is assumed.

## Honest demo boundary

The three resource payloads are deterministic simulated content. Their x402 challenges and configured live TestNet payment path are real. Unit tests use boundary doubles and never claim blockchain settlement. The live smoke mode requires funded disposable TestNet wallets.

## Production posture

This hackathon implementation uses process-local jobs, replay reservations, and audit events, plus environment-provided TestNet mnemonics. A production deployment needs durable atomic storage and KMS/HSM signer custody.
