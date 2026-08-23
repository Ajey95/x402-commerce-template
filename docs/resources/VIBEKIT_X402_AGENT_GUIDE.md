# VibeKit + Algorand x402 Agent Guide for CPMM-SHIELD

## Purpose

VibeKit is used to improve the coding agent's Algorand/x402 knowledge and tooling. It is **not** part of CPMM-SHIELD's runtime payment path.

Runtime settlement continues to use the official x402 TypeScript/AVM packages already present in this repository, the configured GoPlausible facilitator, and Algorand USDC.

## Recommended development setup

When VibeKit is available in the developer environment:

```bash
vibekit init
vibekit status
```

The canonical Algorand Agent Skills collection contains the `algorand-x402-typescript` skill. VibeKit can install/configure these skills for the selected coding agent.

The Algorand DevRel repository also supports the standard agent-skills CLI. From the project root, the canonical interactive install is:

```bash
npx skills add algorand-devrel/algorand-agent-skills/skills
```

Select `algorand-x402-typescript` for this project, plus any other Algorand skills needed by the task. Update installed skills later with:

```bash
npx skills update
```

Canonical source:

- `https://github.com/algorand-devrel/algorand-agent-skills`
- `skills/algorand-x402-typescript/SKILL.md` in that repository

Use that canonical guidance before making x402 client/server, AVM scheme, facilitator, payment-policy, or Bazaar-discovery changes. Do not substitute an unofficial skill copy.

## Repository merge rule

Do not let VibeKit, the skills CLI, or any setup tool overwrite project guidance.

The effective instruction order is:

```text
canonical Algorand/x402 skill knowledge
            +
repository AGENTS.md
            +
CPMM-SHIELD local skill + approved design/spec
            =
actual coding behavior
```

When generic agent guidance conflicts with `AGENTS.md` or `skills/cpmm-shield-x402/SKILL.md`, the CPMM-SHIELD project-specific security invariants win.

## What the coding agent must understand

### HTTP 402 lifecycle

A valid unpaid protected request receives an HTTP 402 challenge. The payer signs the advertised payment requirement and retries. The resource server/facilitator validates and settles the payment. Protected business logic runs only after settlement is confirmed.

### CPMM-SHIELD adds a second payment boundary

The upstream payment does not authorize arbitrary downstream spending. After upstream settlement:

1. the shield resolves requested resource IDs through its trusted registry;
2. a separate treasury payer calls those x402 resources;
3. every downstream payment requirement is filtered against trusted network, asset, price, and recipient policy before signing;
4. every downstream settlement receipt is required;
5. every response passes the response firewall;
6. only validated results are returned in the signed receipt.

### Trust boundary

An AI model may choose from trusted resource IDs and fill bounded inputs. It must not control:

- provider URL or origin;
- payment recipient;
- network or asset;
- server response schema;
- treasury credentials;
- policy limits.

For an `external-curated` provider, the registry must pin a valid Algorand `payTo` address. Bazaar discovery provides candidates, not authorization to spend.

## Secret-handling rules

- Never paste a mnemonic or private key into an AI prompt.
- Never commit `.env`.
- Never log signer secrets.
- `PAY_TO_ADDRESS` is public receiver configuration, not a private key.
- `CLIENT_MNEMONIC` and `TREASURY_MNEMONIC` are disposable TestNet credentials in the hackathon flow.
- Mainnet must not use `DEMO_MODE=true`.
- A production successor should move signer custody to KMS/HSM or another explicit secure signer abstraction.

## How to use AI assistance safely

Before accepting an agent-generated x402 change, verify:

1. invalid input still fails before payment;
2. official payment requirements still use the intended scheme/network/asset/payTo;
3. settlement still happens before protected logic;
4. downstream provider URLs come from the trusted registry;
5. curated external providers pin a valid recipient and treasury pre-sign policy enforces it;
6. downstream paid responses still require settlement receipts;
7. response validation still uses the server-owned schema;
8. Bazaar metadata matches the real public request contract;
9. no secret material was introduced.

Then run:

```bash
pnpm build
pnpm test
pnpm smoke
pnpm simulate
pnpm x402 inspect
pnpm x402 checklist
```

Run the funded live TestNet acceptance path only when disposable credentials are configured:

```bash
LIVE_X402=true pnpm smoke
```

Do not treat simulated or mocked output as live blockchain evidence.

## Runtime non-goal

Do not add VibeKit as an HTTP middleware, payment verifier, treasury signer, or runtime dependency merely because it is listed in HackCulture resources. Its value here is giving development agents correct Algorand context and tools while CPMM-SHIELD's runtime remains small and auditable.
