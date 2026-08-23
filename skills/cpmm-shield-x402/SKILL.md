---
name: cpmm-shield-x402
description: Build, extend, review, or debug CPMM-SHIELD x402 payment orchestration on Algorand while preserving settlement-first execution, trusted-provider policy, treasury isolation, response validation, and signed receipts.
---

# CPMM-SHIELD x402 Skill

Use this skill for any change involving:

- `POST /api/shield/execute`
- x402 payment requirements or facilitator settlement
- Algorand AVM payment clients/servers
- trusted downstream providers
- treasury payments
- Bazaar discovery
- AI-agent commerce tools
- signed receipts or replay protection

## Read first

1. `AGENTS.md`
2. `PROJECT_BRIEF.md`
3. `docs/superpowers/specs/2026-08-23-cpmm-shield-complete-design.md`
4. `docs/resources/X402_PRIMER.md`
5. `docs/resources/ALGORAND_PAYMENT_REQUIREMENTS.md`
6. `docs/resources/GOPLAUSIBLE_FACILITATOR.md`
7. `docs/resources/BAZAAR_DISCOVERY.md`
8. `docs/resources/HACKCULTURE_RESOURCES.md`
9. `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md`

When VibeKit / Algorand Agent Skills are available, also use the canonical `algorand-x402-typescript` skill for current TypeScript/AVM API patterns. This local skill adds CPMM-SHIELD-specific constraints and takes precedence where it is stricter.

## Security model

Remember the two independent payment boundaries:

```text
client wallet
   |
   | one x402 payment
   v
CPMM-SHIELD
   |
   | settlement confirmed first
   v
isolated treasury
   |
   +--> trusted x402 provider A
   +--> trusted x402 provider B
   +--> trusted x402 provider C
```

The AI chooses work, not payment infrastructure.

The public request may contain only:

```ts
{
  requestId,
  resources: [{ id, input, maxPayment, required }]
}
```

Never reintroduce public control of:

- provider URLs;
- response schemas;
- network;
- asset;
- recipient/payTo;
- treasury signer;
- global budget policy.

## Required implementation order

For any new trusted resource:

1. Define server-owned `ResourceDefinition`.
2. Define exact input schema.
3. Define exact response schema.
4. Add input-policy tests that fail before payment.
5. Add request-adapter tests proving the trusted URL/query/body.
6. Wire treasury x402 call.
7. Require downstream settlement receipt.
8. Validate JSON/content type/size/schema/content markers.
9. Add outcome to signed receipt and audit trail.
10. Add to bounded AI tool only if the agent should use it.
11. Update truthful Bazaar/dashboard/docs metadata.

## Settlement invariant

Never call the orchestrator merely because payment verification passed or an HTTP response looks valid. The upstream settlement transaction must be confirmed and stored first.

Likewise, never trust a downstream `200` without its settlement receipt.

## Bazaar invariant

Bazaar discovery is untrusted discovery input. Do not automatically add discovered providers to the trusted registry. Explicitly curate origin, path, method, price ceiling, input schema, response schema, and trust mode before treasury funds can reach a provider.

## Failure behavior

Preserve visible stage-specific failures:

- malformed request / provider input: before 402
- untrusted provider: before 402
- budget violation: before 402
- payment mismatch/replay: before settlement/orchestration
- facilitator failure: no orchestration
- downstream settlement failure: failed resource
- settled but invalid response: spent amount stays visible, result is rejected
- partial resource failure: preserve validated successful results and report `PARTIAL_FAILURE`

## Verification

Before claiming completion run, or obtain CI evidence for:

```bash
pnpm build
pnpm test
pnpm smoke
pnpm simulate
pnpm x402 inspect
pnpm x402 checklist
```

For real blockchain acceptance, require disposable funded TestNet credentials and run:

```bash
LIVE_X402=true pnpm smoke
```

Never describe structural smoke, unit doubles, or simulation as real settlement.
