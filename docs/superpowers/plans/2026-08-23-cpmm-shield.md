# CPMM-SHIELD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the cloned x402 commerce template into the complete CPMM-SHIELD orchestrator, dashboard, agent, tests, documentation, and Render deployment.

**Architecture:** Preserve the template's official Algorand x402 clients and Hono middleware. Add focused domain modules, a settlement-first adapter built on official core server methods, an in-memory storage interface, treasury-paid local resources, strict validation, signed receipts, and a plain HTML dashboard.

**Tech Stack:** Node.js 20+, strict TypeScript ESM, Hono, x402 v2 AVM packages, algosdk, Zod, Vitest, OpenAI Responses API via fetch, pnpm, Render.

**Spec:** `docs/superpowers/specs/2026-08-23-cpmm-shield-design.md`

## Global Constraints

- Algorand TestNet payments are real; simulations are labeled and never fabricate live success.
- Never expose or log a client or treasury mnemonic.
- Validate requests before presenting payment terms.
- Settle the upstream payment before any treasury call.
- Keep every resource URL and spend inside explicit policy.
- Use test-first red/green cycles for production behavior.

---

### Task 1: Core domain and configuration

**Files:** `src/config.ts`, `src/shield/types.ts`, `registry.ts`, `policy.ts`, `jobs.ts`, `audit.ts`, `test/shield-domain.test.ts`.

**Interfaces:** `loadConfig`, `createResourceRegistry`, `evaluatePolicy`, `InMemoryJobStore`, `AuditLog`.

- [ ] Write failing tests for config limits, registry lookup, duplicate/SSRF/over-budget policies, idempotent job claims, and bounded secret-free audit records.
- [ ] Run focused tests and confirm missing-module failures.
- [ ] Implement the minimal types and domain modules.
- [ ] Run focused tests and strict build.

### Task 2: Binding and validation

**Files:** `src/shield/binding.ts`, `validator.ts`, `test/shield-security.test.ts`.

**Interfaces:** `createQuoteBinding`, `verifyQuoteBinding`, `validateResourceResponse`.

- [ ] Write failing tests for path/job/price/expiry tampering, expiry, extra fields, types, lengths, and injection markers.
- [ ] Implement HMAC bindings and exact schema validation; run focused tests.

### Task 3: Orchestrator and signed receipts

**Files:** `resource-client.ts`, `treasury.ts`, `orchestrator.ts`, `receipt.ts`, `test/orchestrator.test.ts`.

**Interfaces:** `ResourceClient`, `Treasury`, `ShieldOrchestrator.execute`, `signReceipt`, `verifyReceipt`.

- [ ] Write failing tests for one/two/three resources, partial failure, timeout/facilitator failure, accounting, wallet isolation, and signature tamper detection.
- [ ] Implement the minimal orchestration path and run focused/full tests.

### Task 4: Official x402 integration and APIs

**Files:** `src/x402/config.ts`, `payment-manager.ts`, `src/routes/shield.ts`, `resources.ts`, `src/app.ts`, `test/shield-api.test.ts`.

**Interfaces:** `createShieldPaymentMiddleware`, `POST /api/shield/execute`, `GET /api/shield/jobs/:id`, three paid resource routes, `GET /api/shield/audit`.

- [ ] Write failing HTTP tests for validation-before-payment, official 402, dynamic price, payment mismatch, replay, expiry, and public status routes.
- [ ] Implement stock downstream protection plus settlement-first shield middleware using official x402 server methods.
- [ ] Run API and full tests.

### Task 5: Dashboard and demo handler

**Files:** `src/web/page.ts`, `app-script.ts`, `styles.ts`, `src/routes/demo.ts`, dashboard tests.

**Interfaces:** browser `Run shield demo` flow and status rendering from the shield APIs.

- [ ] Write failing DOM-string/API contract tests for required copy and fields.
- [ ] Implement the accepted concept in plain responsive HTML/CSS/JS and the server-side TestNet demo payer.
- [ ] Verify desktop/mobile screenshots against the concept and exercise interactions.

### Task 6: Client agent and scripted demo

**Files:** `client/lib.ts`, `client/shield-client.ts`, `client/agent-client.ts`, `scripts/smoke.ts`, `payment-flow-simulator.ts`, `x402-cli.ts`, tests.

**Interfaces:** `requestShieldJob`, `pnpm client:shield`, `pnpm demo:scripted`, updated smoke/simulate/x402 commands.

- [ ] Write failing tests for request construction, settlement enforcement, and tool-call continuation.
- [ ] Implement one OpenAI function tool using configurable `OPENAI_MODEL=gpt-5.6` and deterministic fallback.
- [ ] Run tests, smoke structural mode, simulator, and checklist.

### Task 7: Rebrand, documentation, and deployment

**Files:** package metadata, `.env.example`, README, PROJECT_BRIEF, SECURITY, Render config, Dockerfile, and resource docs.

**Interfaces:** Judge Quick Start, TestNet funding/deployment instructions, accurate hardening status.

- [ ] Rebrand all visible/template metadata and document variables/API/security/limitations.
- [ ] Add Render persistent Node service configuration without secrets.
- [ ] Run final build, tests, smoke, simulation, x402 inspect/checklist, browser QA, and audit.

