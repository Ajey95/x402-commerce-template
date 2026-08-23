# CPMM-SHIELD Implementation Map

Use this map when asking where a behavior lives or when a coding agent needs to change the project safely.

CPMM-SHIELD is an x402 Global Challenge **Orchestrator entry**: one paid shield request coordinates multiple trusted downstream x402 resources and returns one validated signed receipt.

## Agent knowledge

| Need | Files |
| --- | --- |
| Project-specific agent invariants | `AGENTS.md` |
| Compact coding workflows | `skills.md` |
| CPMM-SHIELD local skill | `skills/cpmm-shield-x402/SKILL.md` |
| VibeKit / canonical Algorand x402 guidance | `docs/resources/VIBEKIT_X402_AGENT_GUIDE.md` |
| Organizer-provided resources | `docs/resources/HACKCULTURE_RESOURCES.md` |
| Approved architecture | `docs/superpowers/specs/2026-08-23-cpmm-shield-complete-design.md` |

## Public shield request boundary

| Need | Files |
| --- | --- |
| Request/domain types | `src/shield/types.ts` |
| Strict JSON request parsing | `src/shield/request.ts` |
| Provider-specific input schema validation | `src/shield/input-validator.ts` |
| Owned provider definitions | `src/shield/registry.ts` |
| Network-selected curated external definitions | `src/shield/trusted-providers.ts` |
| Resource count and spending policy | `src/shield/policy.ts` |
| Quote creation / request hashing | `src/shield/quote.ts`, `src/shield/binding.ts` |

The public request is intentionally limited to `{ requestId, resources: [{ id, input, maxPayment, required }] }`. Provider URLs, response schemas, recipients, network, and asset remain server controlled.

## Settlement and orchestration

| Need | Files |
| --- | --- |
| Upstream settlement-first middleware | `src/shield/payment-manager.ts` |
| In-memory job/replay state | `src/shield/jobs.ts` |
| Audit trail | `src/shield/audit.ts` |
| Orchestration and terminal status | `src/shield/orchestrator.ts` |
| Ed25519 aggregate receipt | `src/shield/receipt.ts` |

## Trusted downstream providers

| Need | Files |
| --- | --- |
| Provider registry | `src/shield/registry.ts` |
| Trusted URL/query/body construction | `src/shield/provider-request.ts` |
| Isolated treasury x402 payer | `src/shield/treasury.ts` |
| Resource-client error model | `src/shield/resource-client.ts` |
| Response firewall | `src/shield/validator.ts` |
| Owned deterministic demo resources | `src/routes/resources.ts` |

`owned-demo` resources are hosted by this service. `external-curated` resources are independently hosted and must be explicitly trusted. `getTrustedExternalProviders(networkName)` exposes only `external-algo-price` on TestNet or only `external-hash` on MainNet, and `src/app.ts` selects before building the registry. Bazaar discovery alone never authorizes treasury spending.

## HTTP routes

| Need | Files |
| --- | --- |
| App composition / middleware order | `src/app.ts` |
| Shield API and public metadata | `src/routes/shield.ts` |
| Browser server-side TestNet demo payer | `src/routes/shield-demo.ts` |
| Legacy wallet example | `src/routes/wallet.ts`, `src/routes/demo.ts` |
| Server start | `src/server.ts` |

## x402 and facilitator

| Need | Files |
| --- | --- |
| Protected route + Bazaar registration | `src/x402/config.ts` |
| AVM paying client | `src/x402/client.ts` |
| Network, USDC, receiver and facilitator config | `src/config.ts`, `.env`, `.env.example` |
| GoPlausible explanation | `docs/resources/GOPLAUSIBLE_FACILITATOR.md` |
| Bazaar explanation | `docs/resources/BAZAAR_DISCOVERY.md` |
| Payment inspection CLI | `scripts/x402-cli.ts` |

## Clients and AI agent

| Need | Files |
| --- | --- |
| Shield paying-client lifecycle | `client/shield-client.ts` |
| Deterministic three-resource demo | `client/scripted-shield-client.ts` |
| Bounded OpenAI tool-calling agent | `client/agent-client.ts` |
| Network-aware bounded tool schema/instructions | `client/shield-tool.ts` |
| Model availability fallback | `client/openai-model.ts` |
| Shared payer helpers | `client/lib.ts` |

The AI agent may choose only trusted resource IDs and bounded inputs. It does not receive treasury credentials or arbitrary payment infrastructure controls.

## Dashboard

| Need | Files |
| --- | --- |
| Judge-facing HTML | `src/web/page.ts` |
| Browser request/receipt/audit behavior | `src/web/app-script.ts` |
| Presentation styling | `src/web/styles.ts` |

## Verification

| Need | Files |
| --- | --- |
| Unit/integration tests | `test/` |
| Provider adapter tests | `test/provider-request.test.ts` |
| Structural/live smoke | `scripts/smoke.ts` |
| No-funds simulation | `scripts/payment-flow-simulator.ts` |
| Agent sandbox | `scripts/agent-sandbox.ts` |
| GitHub CI | `.github/workflows/ci.yml` |

## Safe customization order

1. Read `AGENTS.md` and the approved design.
2. Update `PROJECT_BRIEF.md` if product scope changes.
3. Add/change trusted provider metadata and exact schemas.
4. Add pre-payment provider-input policy tests.
5. Add trusted request adapter + treasury tests.
6. Change orchestration/response validation only if necessary.
7. Update x402/Bazaar metadata when the public contract changes.
8. Update bounded clients/agent and dashboard.
9. Update documentation.
10. Run build, tests, smoke, simulator, x402 inspection/checklist, and live TestNet acceptance only when funded disposable credentials are available.
