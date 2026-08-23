# AGENTS.md

This repository contains CPMM-SHIELD, a settlement-first x402 payment firewall and orchestrator for AI agents on Algorand.

## Agent Knowledge Layer

Before changing payment, wallet, provider, or discovery code:

1. Read `PROJECT_BRIEF.md`, `skills.md`, `README.md`, the approved design under `docs/superpowers/specs/`, and the docs under `docs/resources/`.
2. Read `skills/cpmm-shield-x402/SKILL.md`.
3. If VibeKit / Algorand Agent Skills are installed in the coding environment, use the canonical `algorand-x402-typescript` guidance for AVM/x402 work.
4. Merge generic VibeKit/Algorand guidance with this file. **Project-specific invariants in this repository take precedence.** Never overwrite this file with generated agent instructions.
5. VibeKit is a development/agent-knowledge layer. Do not add VibeKit to the runtime settlement path unless a future approved design explicitly requires it.

See `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` and `docs/resources/HACKCULTURE_RESOURCES.md`.

## Default Goal

When the participant asks to extend CPMM-SHIELD, implement the requested behavior end to end while preserving the payment-security boundary:

1. Parse and validate malformed input before any x402 challenge.
2. Resolve provider information only from the server-owned trusted registry.
3. Keep the payment lifecycle intact: unpaid valid request returns `402`, paid retry verifies through the facilitator, settlement occurs on Algorand, and only then orchestration begins.
4. Downstream payments use the isolated treasury payer.
5. Treat downstream HTTP success as insufficient. Require settlement confirmation and response validation before aggregation.
6. Keep secrets local. Never print or commit `.env`, mnemonics, private keys, API keys, or funded wallet credentials.
7. Keep Bazaar metadata truthful when the public contract changes.
8. Verify with `pnpm build`, `pnpm test`, `pnpm smoke`, `pnpm simulate`, `pnpm x402 inspect`, and `pnpm x402 checklist`. Run live TestNet acceptance only when disposable funded credentials are actually available.

## CPMM-SHIELD x402 Invariants

- The primary protected route is `POST /api/shield/execute` and must remain registered in `src/x402/config.ts`.
- Invalid input must be rejected before x402 middleware so callers are never charged for malformed requests.
- The public shield request may contain only a trusted resource `id`, provider-specific `input`, `maxPayment`, and `required` flag.
- Clients and AI models must not choose arbitrary provider URLs, response schemas, recipient addresses, networks, or assets.
- Provider URL/method/input schema/response schema/pricing/trust metadata comes from `src/shield/registry.ts` and explicitly curated provider definitions.
- Bazaar discovery is discovery, not authorization. Never automatically trust or pay a newly discovered endpoint.
- `PAY_TO_ADDRESS` is the public upstream receiver address only. The receiver private key is not required by the server.
- `CLIENT_MNEMONIC` is only for disposable TestNet paying clients and the optional demo agent.
- `TREASURY_MNEMONIC` is the isolated downstream TestNet payer and receipt signer in this hackathon build.
- `DEMO_MODE=true` is TestNet-only and must never be enabled for Mainnet.
- A paid client must treat a `200` response as complete only when the settlement receipt reports success.
- The shield must not execute downstream work until upstream facilitator settlement is confirmed.
- Downstream calls must reject redirects, require successful x402 settlement, require JSON, enforce byte limits, and pass the trusted response schema before results are exposed to the AI.
- A settled but invalid downstream response still counts as spent money and must be visible in the signed receipt.
- Replayed payment proofs must remain rejected.
- Bazaar discovery metadata must describe the real request contract, output, price behavior, and use case. Do not leave placeholder metadata after changes.
- Owned demonstration providers must remain visibly labeled `SIMULATED CONTENT / REAL TESTNET PAYMENT` when the payment path is live.
- In-memory jobs, replay reservations, quote state, and audit events are hackathon limitations, not production durability.

## Trusted Provider Change Checklist

When adding or changing a downstream provider:

1. Add or update the `ResourceDefinition` with explicit `origin`, `path`, `method`, `priceAtomic`, `inputSchema`, `responseSchema`, `trust`, description, and tags.
2. Never accept provider URL/schema overrides from the public request.
3. Add provider-input validation tests that fail before payment.
4. Add provider request-mapping tests for the exact query/body sent to the trusted origin.
5. Confirm the treasury client still requires a downstream settlement receipt.
6. Add response-schema and unsafe-response boundary tests.
7. Expose only safe provider metadata from `GET /api/shield/resources`.
8. Update the OpenAI tool only if the provider should be available to the agent.
9. Update Bazaar/dashboard/docs if the public shield capability changed.
10. Run the full verification commands before claiming completion.

## How To Answer Participant Questions

Use local docs first:

- `docs/resources/X402_PRIMER.md` for protocol concepts.
- `docs/resources/ALGORAND_PAYMENT_REQUIREMENTS.md` for wallet, ALGO, USDC, TestNet, and MainNet setup.
- `docs/resources/GOPLAUSIBLE_FACILITATOR.md` for facilitator responsibilities.
- `docs/resources/BAZAAR_DISCOVERY.md` for discoverability.
- `docs/resources/AGENTIC_COMMERCE_PATTERNS.md` for paid service ideas.
- `docs/resources/TROUBLESHOOTING_PLAYBOOK.md` for debugging.
- `docs/resources/HACKCULTURE_RESOURCES.md` for the exact organizer resource list.
- `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` for the VibeKit/Algorand coding-agent workflow.

Use current external documentation when deployment rules, package APIs, network identifiers, asset IDs, or facilitator behavior may have changed.

## Done Definition

A CPMM-SHIELD change is done only when:

- `pnpm build` and `pnpm test` pass.
- `pnpm smoke` reaches `/health`, validates the trusted registry, rejects malformed input before payment, and receives an official `402` from the shield route.
- `pnpm simulate`, `pnpm x402 inspect`, and `pnpm x402 checklist` pass or report the expected non-live state.
- A paid TestNet request settles through GoPlausible when disposable funded credentials are available; never fabricate this evidence.
- The dashboard demonstrates policy, challenge, upstream settlement, treasury execution, validation, and signed receipt.
- `README.md`, `PROJECT_BRIEF.md`, and `.env.example` accurately describe the actual implementation and its limitations.
