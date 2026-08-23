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

The canonical Algorand Agent Skills collection contains `algorand-x402-typescript` guidance. Use that guidance before making x402 client/server, AVM scheme, facilitator, or discovery changes.

If an agent-skill installer is used instead of VibeKit's interactive setup, use the canonical source from `algorand-devrel/algorand-agent-skills` rather than an unofficial copy.

## Repository merge rule

Do not let setup tools overwrite project guidance.

The effective instruction order is:

```text
canonical Algorand/x402 skill knowledge
            +
repository AGENTS.md
            +
CPMM-SHIELD design/spec
            =
actual coding behavior
```

When generic agent guidance conflicts with `AGENTS.md`, the CPMM-SHIELD project-specific security invariants win.

## What the coding agent must understand

### HTTP 402 lifecycle

A valid unpaid protected request receives an HTTP 402 challenge. The payer signs the advertised payment requirement and retries. The resource server/facilitator validates and settles the payment. Protected business logic runs only after settlement is confirmed.

### CPMM-SHIELD adds a second payment boundary

The upstream payment does not authorize arbitrary downstream spending. After upstream settlement:

1. the shield resolves requested resource IDs through its trusted registry;
2. a separate treasury payer calls those x402 resources;
3. every downstream settlement receipt is required;
4. every response passes the response firewall;
5. only validated results are returned in the signed receipt.

### Trust boundary

An AI model may choose from trusted resource IDs and fill bounded inputs. It must not control:

- provider URL or origin;
- payment recipient;
- network or asset;
- server response schema;
- treasury credentials;
- policy limits.

Bazaar discovery provides candidates, not authorization to spend.

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
5. downstream paid responses still require settlement receipts;
6. response validation still uses the server-owned schema;
7. Bazaar metadata matches the real public request contract;
8. no secret material was introduced.

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
