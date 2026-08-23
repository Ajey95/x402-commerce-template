# Tech Stack

This template is intentionally small and TypeScript-first. It gives participants the full x402 payment path without forcing a frontend framework, database, auth provider, or cloud-specific runtime.

## Core Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+ |
| Language | TypeScript, ESM |
| Package manager | pnpm |
| Server framework | Hono |
| Node server adapter | `@hono/node-server` |
| Environment config | `dotenv` and `.env` |
| Tests | Vitest |
| Script runner | `tsx` |

## x402 And Payments

| Layer | Technology |
| --- | --- |
| x402 server middleware | `@x402/hono` |
| x402 core types/client pieces | `@x402/core` |
| Algorand x402 scheme | `@x402/avm` |
| Bazaar discovery extension | `@x402/extensions` 2.19.x, aligned with x402 core |
| Facilitator | GoPlausible facilitator |
| Settlement chain | Algorand |
| Default local network | Algorand TestNet |
| Production network | Algorand MainNet |
| Payment asset | USDC ASA |
| Algorand SDK | `algosdk` |

## Default Sample Resource

The starter project ships with a paid wallet-data example so participants can test x402 before replacing the resource.

| Piece | Technology |
| --- | --- |
| Paid route | `GET /api/wallet/:address` |
| Data source | AlgoNode Algorand Indexer |
| TestNet USDC ASA | `10458941` |
| Browser demo | Plain HTML, CSS, and JavaScript served by Hono |

## Template Extras

| Extra | Files |
| --- | --- |
| AI-agent instructions | `AGENTS.md` |
| Agent skill guide | `skills.md` |
| Participant brief | `PROJECT_BRIEF.md` |
| x402 helper CLI | `scripts/x402-cli.ts` |
| Agent testing sandbox | `scripts/agent-sandbox.ts` |
| Payment flow simulator | `scripts/payment-flow-simulator.ts` |
| Client SDK helpers | `sdk/extensions.ts` |
| Smart contract templates | `contracts/templates/` |
| Reference docs | `docs/resources/` |

## What Is Not Included By Default

- No React or Next.js.
- No database.
- No login or user accounts.
- No hosted deployment adapter.
- No production key management.
- No custom smart contract requirement for the basic exact-payment flow.

Add those only when the participant's paid resource actually needs them.
