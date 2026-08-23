# AI Agent Skills For CPMM-SHIELD

Use this file as the compact operating manual for a coding agent working in this repository. For Algorand/x402 changes, also read `AGENTS.md`, `skills/cpmm-shield-x402/SKILL.md`, and `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md`.

## Skill: Preserve the settlement-first shield boundary

1. Parse and validate the entire shield request before x402 middleware.
2. Resolve each resource only through the server-owned trusted registry.
3. Evaluate provider input, duplicate IDs, resource count, per-resource ceiling, and total job budget.
4. Create the bound quote and return HTTP 402 for a valid unpaid request.
5. On paid retry, verify the advertised amount/network/asset/payTo and reserve the payment proof against the job.
6. Settle through the facilitator.
7. Start orchestration only after a settlement transaction is stored.
8. Pay downstream resources through the isolated treasury client.
9. Require downstream settlement plus response validation.
10. Sign the final aggregate receipt.

Never move business logic ahead of settlement just to simplify a test or demo.

## Skill: Add a trusted downstream x402 provider

1. Add a `ResourceDefinition` with explicit `id`, `name`, `origin`, `path`, `method`, `priceAtomic`, `inputSchema`, `responseSchema`, `trust`, description, and tags.
2. Use `trust: 'owned-demo'` only for routes hosted by CPMM-SHIELD; use `external-curated` for independently hosted x402 providers.
3. Add provider-input validation tests proving malformed or extra fields fail before payment.
4. Add provider-request mapping tests proving the exact trusted URL/query/body produced by `buildProviderRequest()`.
5. Confirm the treasury payer requires a successful downstream settlement receipt.
6. Add response-schema and unsafe-response tests.
7. Expose only safe metadata from `/api/shield/resources`.
8. If the AI agent should use the provider, add the resource ID and input contract to its bounded tool schema.
9. Never auto-trust a provider merely because it appears in Bazaar.

## Skill: Turn an idea into a paid x402 API

For a new owned paid resource:

1. Update `PROJECT_BRIEF.md` if product scope changes.
2. Define strict input validation before x402.
3. Implement the handler.
4. Register the resource in `src/shield/registry.ts` and `src/x402/config.ts` where applicable.
5. Update Bazaar metadata with truthful examples.
6. Update clients/dashboard only if they need to expose the resource.
7. Add tests for malformed input, unpaid 402, downstream settlement, and successful validated output.
8. Run build/test/smoke/simulator checks.

## Skill: Debug x402 payment failures

Check in this order:

1. Does `/health` return `200`?
2. Does a valid unpaid shield request return `402`?
3. Does malformed provider input return `4xx` with no `payment-required` header?
4. Does the payment requirement include the expected scheme, network, amount, asset, and payTo?
5. Are client, upstream receiver, and treasury roles configured intentionally?
6. Are payer accounts funded with ALGO and opted into the correct USDC asset?
7. Does the payer have enough USDC?
8. Does `FACILITATOR_URL` support the selected network?
9. Does the upstream paid response include a successful settlement receipt?
10. For each downstream provider, does the treasury response include a successful settlement receipt?
11. Does the downstream body pass JSON/content-type/byte/schema checks?
12. If replay is involved, is the proof already reserved or consumed by another job?

## Skill: Prepare for public discovery

1. Deploy over HTTPS.
2. Set MainNet env vars only when explicitly ready for real payments.
3. Use the GoPlausible facilitator.
4. Keep Bazaar discovery enabled and metadata accurate.
5. Enable `CHALLENGE_MODE=true` only when challenge attribution is intended.
6. Complete a real paid request.
7. Verify the shield resource appears in the GoPlausible resource catalog.
8. Verify on-chain transaction IDs in Lora/Pera explorers.
9. Do not claim discovery or settlement until independently observed.

## Skill: Use VibeKit / Algorand Agent Skills

1. Treat VibeKit as coding-agent tooling, not runtime payment middleware.
2. When installed, use the canonical Algorand `algorand-x402-typescript` guidance before modifying x402/AVM code.
3. Merge VibeKit-generated guidance with repository `AGENTS.md`; never replace project-specific rules.
4. Keep mnemonics/private keys outside model prompts, logs, and committed files.
5. Use official/current docs for changing package APIs, network IDs, asset IDs, facilitator behavior, or deployment requirements.
6. Re-run repository verification after any agent-assisted payment change.

## Skill: Keep the project safe

- Never commit `.env`.
- Never log mnemonics or private keys.
- Never use a production mnemonic for local demos.
- Never enable `DEMO_MODE` on Mainnet.
- Never let the public request override trusted URLs, schemas, networks, assets, or recipients.
- Reject malformed inputs before x402 middleware.
- Reject redirects and unconfirmed downstream settlement.
- Never auto-trust Bazaar discovery results.
- Do not claim Bazaar indexing or live blockchain settlement unless actually verified.
