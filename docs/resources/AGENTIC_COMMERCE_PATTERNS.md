# Agentic Commerce Patterns

Good x402 services sell a small, clear unit of value that software can evaluate before paying.

## Strong Starter Ideas

| Pattern | Paid unit | Example |
| --- | --- | --- |
| Data lookup | One JSON result | Risk score, token metadata, address profile |
| Verification | One proof or verdict | Human check, document status, fraud flag |
| Enrichment | One transformed payload | Cleaned lead, normalized address, summary |
| Compute | One bounded job | Simulation, quote, route, ranking |
| Access | One content item | Report, file, premium feed item |
| Action | One external operation | Create ticket, post alert, trigger workflow |
| Orchestration | One settled aggregate job | Pay several allowlisted providers, validate outputs, return one signed receipt |

## Design Rules

- Keep the paid unit small.
- Price it low enough for autonomous testing.
- Return structured JSON by default.
- Make input and output schemas explicit.
- Avoid hidden side effects unless the route clearly sells an action.
- Add buyer policy examples so agents know when to pay.
- For orchestrators, pin every downstream network, asset, amount, recipient, input schema, and response schema before any signer is invoked.

## Bad Fits

- Long-running jobs without status tracking.
- Vague "AI answer" endpoints with no output contract.
- Expensive side effects before payment verification.
- Data that cannot be legally or safely sold per request.
