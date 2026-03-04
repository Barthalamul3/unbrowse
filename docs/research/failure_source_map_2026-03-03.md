# Failure-First Source Map (2026-03-03)

## Stack Inventory (Initial Recon)

### Languages and Runtime
- TypeScript/ESM source in `src/**/*.ts`
- Bun runtime and toolchain (`bun`, `bun install`, `bun src/index.ts`)
- Node APIs used directly (`fetch`, `AbortSignal`, `child_process`, `crypto`, `fs`, `os`, `path`)

### Frameworks and Key Packages
- `fastify@^5.7.4`
- `@fastify/cors@^11.2.0`
- `@fastify/rate-limit@^10.3.0`
- `agent-browser@^0.12.0`
- `nanoid@^5.1.6`

### System Components
- API server and route proxy (`src/index.ts`, `src/api/routes.ts`)
- Orchestration pipeline (`src/orchestrator/index.ts`)
- Execution and retry (`src/execution/index.ts`, `src/execution/retry.ts`)
- Browser capture subsystem (`src/capture/index.ts`)
- Auth + vault (`src/auth/*`, `src/vault/index.ts`)
- Verification loop (`src/verification/index.ts`)
- CLI (`src/cli.ts`)

## Planned Change Themes
1. Reliability hardening (timeouts, retries, error handling, startup safety)
2. Quality gate hardening (tests, CI, repeatable verification)
3. Capture/execution robustness and state isolation
4. Security posture hardening for operational behavior and mutation safety

## Primary Documentation Sources (Latest looked up 2026-03-03)

### Fastify core hooks and lifecycle
- https://fastify.dev/docs/latest/Reference/Hooks/
- Why relevant:
  - Confirms correct usage/scope of `onRequest` and lifecycle hooks
  - Guides route/plugin encapsulation choices for auth/rate-limit/security hooks

### Fastify rate limit plugin compatibility and behavior
- https://github.com/fastify/fastify-rate-limit
- Why relevant:
  - Confirms plugin/fastify compatibility matrix (`>=10.x` for Fastify `^5.x`)
  - Documents global and route-level limiter behavior and options

### Bun docs (runtime + package manager)
- https://bun.com/docs
- Why relevant:
  - Canonical runtime/package manager behavior
  - Baseline for environment assumptions and command semantics

### Bun test runner and CI guidance
- https://bun.com/docs/guides/test
- https://bun.com/docs/cli/test
- Why relevant:
  - Defines test discovery and CLI options (`--timeout`, `--randomize`, `--rerun-each`, JUnit output)
  - Provides CI integration guidance for GitHub Actions and deterministic test behavior

### Node.js fetch/AbortSignal semantics
- https://nodejs.org/en/learn/getting-started/fetch
- https://nodejs.org/api/globals.html
- Why relevant:
  - Confirms fetch behavior and AbortSignal timeout/cancellation capabilities
  - Supports explicit timeout/cancellation hardening in API client/proxy paths

### Playwright browser-context isolation (capture subsystem alignment)
- https://playwright.dev/docs/browser-contexts
- https://playwright.dev/docs/api/class-browsercontext
- Why relevant:
  - Documents context isolation and lifecycle (`newContext`, `close`)
  - Supports safer capture session boundaries and cleanup strategy

## Change-to-Source Linkage

### A. Add explicit request timeout + cancellation for backend/proxy fetches
- Components: `src/client/index.ts`, `src/api/routes.ts`, `src/execution/index.ts`
- Sources:
  - Node fetch docs: https://nodejs.org/en/learn/getting-started/fetch
  - Node globals AbortSignal: https://nodejs.org/api/globals.html

### B. Refine hook/rate-limit placement and route controls
- Components: `src/api/routes.ts`, `src/ratelimit/index.ts`
- Sources:
  - Fastify hooks: https://fastify.dev/docs/latest/Reference/Hooks/
  - fastify-rate-limit: https://github.com/fastify/fastify-rate-limit

### C. Add deterministic reliability test baseline with Bun
- Components: repo scripts/CI + new test files
- Sources:
  - Bun test guide: https://bun.com/docs/guides/test
  - Bun test CLI reference: https://bun.com/docs/cli/test

### D. Tighten browser capture isolation/cleanup guarantees
- Components: `src/capture/index.ts`, `src/auth/index.ts`
- Sources:
  - Playwright isolation: https://playwright.dev/docs/browser-contexts
  - BrowserContext API: https://playwright.dev/docs/api/class-browsercontext

## Notes
- This source map intentionally prioritizes official docs and maintainer-owned references.
- Before each implementation phase, re-check these URLs for version-specific updates.
