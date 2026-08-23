# HackCulture x402 Global Challenge PreHack Resources

This file records the exact resources supplied in the HackCulture program dashboard for the x402 Global Challenge PreHack. Use repository-local guidance first, then use these official/current resources when package APIs, network configuration, facilitator behavior, wallet setup, or challenge requirements need confirmation.

## Eligibility framing from the organizers

The PreHack does not require a project to begin as a blockchain application. A normal Web2 app, SaaS tool, API, or AI agent qualifies when x402 is integrated so part of the application can charge or pay for access using HTTP 402.

For CPMM-SHIELD, x402 is not a decorative payment button: it is the core machine-to-machine authorization and settlement boundary.

## Start Here

- x402 Documentation: https://docs.x402.org/introduction
- x402 on Algorand — Developer Guide: https://dev.algorand.co/resources/x402-on-algorand/
- x402 GitHub: https://github.com/coinbase/x402
- x402 Kit: https://x402-kit-kappa.vercel.app/

## Setup

- Pera Wallet: https://pera.app/
- AlgoKit: https://algorand.co/algokit
- VibeKit: https://www.getvibekit.ai/
- Algorand Developer Portal: https://dev.algorand.co/

## Build

- Organizer-provided x402 Starter Template: https://github.com/SomehowLiving/x402-commerce-template
- x402 Starter Project: https://github.com/marotipatre/x402-Project

This repository started from the organizer-provided commerce template and extends it with CPMM-SHIELD's settlement-first orchestration, trusted provider policy, replay controls, response firewall, isolated treasury execution, signed aggregate receipts, and bounded AI-agent integration.

## Test & Debug

- Lora Explorer: https://lora.algokit.io/
- Algorand TestNet Explorer: https://testnet.explorer.perawallet.app/
- Pera Explorer: https://explorer.perawallet.app/

Use explorers to independently verify account, asset, and transaction state. Do not infer blockchain settlement from an HTTP 200 or a simulation.

## Discover & Track Your Endpoint

- GoPlausible Facilitator Dashboard: https://facilitator.goplausible.xyz/dashboard/
- x402 Resource Catalog: https://facilitator.goplausible.xyz/dashboard/leaderboards?cat=resources

Bazaar/catalog discovery is not a trust decision. CPMM-SHIELD may inspect discovered resources, but treasury funds may only go to explicitly trusted/curated provider definitions.

## Additional Resources

- Algorand Builder Technical Cheatsheet: https://quickest-reaction-568.notion.site/Algorand-Technical-Resources-2fea260a8fdc8096b969f2248a96617d

## Project-specific precedence

When guidance conflicts or differs in abstraction level, use this order:

1. Security and product invariants in `AGENTS.md` and the approved CPMM-SHIELD design.
2. Current official x402 and Algorand documentation.
3. Current GoPlausible facilitator/Bazaar behavior.
4. VibeKit / Algorand Agent Skills for coding-agent workflow.
5. Examples and starter repositories.

Never weaken settlement-before-execution, secret handling, trusted-provider controls, or response validation merely to match an example snippet.
