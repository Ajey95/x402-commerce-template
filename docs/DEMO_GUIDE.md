# CPMM-SHIELD Orchestrator Demo Guide

The primary demonstration is `POST /api/shield/execute`, not the legacy wallet lookup. The flow should make two payment boundaries visible: the client's upstream payment to CPMM-SHIELD and the isolated treasury's downstream payments to trusted providers.

## 1. Structural no-funds verification

Run:

```bash
pnpm build
pnpm test
pnpm smoke
pnpm simulate
```

Expected evidence:

- the build and tests pass;
- smoke says `NO FUNDS MOVED`;
- the active registry contains four resources: three owned plus one network-selected external provider;
- the deterministic request contains exactly weather, company lookup, and the active external provider;
- the TestNet quote is 0.007000 USDC;
- malformed input is rejected before 402;
- replay reservation is enforced.

This proves structure and policy only. It is not blockchain settlement evidence.

## 2. Browser walkthrough

Start the service and open `http://localhost:3000`:

```bash
pnpm dev
```

Show these dashboard elements:

1. runtime network and treasury readiness;
2. the four-item trusted registry;
3. the three-item deterministic flow;
4. owned results labeled `SIMULATED CONTENT`;
5. the independently hosted result labeled `PROVIDER CONTENT`;
6. policy running before the HTTP 402 quote;
7. upstream settlement, downstream execution, response firewall, and signed receipt stages.

With `DEMO_MODE=false`, the browser is quote-only. `DEMO_MODE=true` is TestNet-only and requires disposable client and treasury credentials.

## 3. Network-selected external provider

| Runtime | Three-item flow |
| --- | --- |
| TestNet | weather + company lookup + `external-algo-price` with exact `{}` input |
| MainNet | weather + company lookup + `external-hash` with `{ text: "CPMM-SHIELD", algo: "sha256" }` |

The browser, scripted client, smoke client, bounded OpenAI tool, and server registry select from the same runtime network. A wrong-network external ID must fail before any payment challenge.

## 4. Live TestNet orchestrator acceptance

Only with deliberately funded disposable TestNet client and treasury accounts, a running configured service, and explicit authorization to spend, run:

```bash
LIVE_X402=true pnpm smoke
```

PowerShell:

```powershell
$env:LIVE_X402='true'; pnpm smoke
```

The scripted client exercises the same shield endpoint:

```bash
pnpm demo:scripted
```

Require evidence for:

- the upstream shield payment settlement transaction;
- downstream settlement receipts for weather, company lookup, and `external-algo-price`;
- validated downstream JSON;
- a valid aggregate receipt signature;
- replay rejection against another job.

Do not describe a structural smoke, simulation, HTTP 200, or unpaid 402 as live settlement.

## 5. MainNet evidence

MainNet is not a demo-payer mode. Before using it, configure secure buyer and treasury signer custody, deliberately funded/USDC-opted-in MainNet accounts, the intended receiver, public HTTPS, and `DEMO_MODE=false`.

Use `pnpm demo:scripted` or `LIVE_X402=true pnpm smoke` against the configured public shield service. Require successful upstream and downstream settlement receipts plus independent on-chain confirmation before making any MainNet success claim.

## 6. Discovery

Bazaar can describe and index `POST /api/shield/execute` after qualifying settled traffic. Discovery is not authorization: only code-curated provider definitions may receive treasury funds. Confirm catalog presence separately and never infer it from local metadata.

## 7. Legacy wallet route

`GET /api/wallet/:address`, `pnpm client:unpaid`, and `pnpm client:paid` remain starter-template compatibility examples for one paid wallet-data response. They do not exercise multi-resource orchestration, downstream treasury settlement, the external provider, response aggregation, or the signed shield receipt. Do not use them as Orchestrator acceptance evidence.
