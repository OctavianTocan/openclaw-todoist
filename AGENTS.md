# OpenClaw Todoist Plugin — AGENTS

> Native Todoist tools for OpenClaw. Keep the implementation small, explicit, and safe across multiple agents.

## Suggested Tags

- openclaw
- todoist
- typescript
- plugin
- multi-agent

## Architecture

- `src/index.ts` — plugin entry. Defines the 12 Todoist tools and wires them to `@doist/todoist-sdk`.
- `src/auth.ts` — resolves the Todoist API token. Honors per-agent override files; agent-scoped paths never fall back to the default token.
- `test/index.test.ts` — Vitest live-API suite. Every created task/project must be cleaned up.
- `biome.json` — formatter + linter. No ESLint, no Prettier.
- `.github/workflows/ci.yml` — gates merges on `main` with `install → lint → build → test`.

## Commands

- `pnpm install`
- `pnpm lint` / `pnpm lint:fix`
- `pnpm build`
- `pnpm test`

**Run `pnpm lint:fix && pnpm build` after every file write.** Ship nothing that does not pass lint and build locally.

## Coding Rules

- pnpm only — never `npm`.
- ESM everywhere. No CommonJS.
- TypeBox schemas expose `snake_case` parameters. The SDK takes `camelCase`; the execute body is the only place that maps between them.
- Do not introduce classes unless you have a concrete stateful reason. Prefer small functions.
- Every exported function, type, and constant gets a short TSDoc. Comments explain *why*, not *what*.
- Keep auth strict: agent-scoped tokens never fall back to the default token.
- Preserve SDK response shapes in `jsonResult`. Do not re-transform fields the SDK already normalizes.

## Destructive Operations

**Destructive tools take explicit IDs. Never introduce bulk-filter delete.** `todoist_delete_task` and `todoist_delete_project` accept a single `id` — nothing else. A filter-based mass delete is a footgun (Hindsight-wipe lesson) and is permanently out of scope.

## Testing Rules

- Tests hit the live Todoist API. No mocks for the SDK client.
- Track every created resource id and delete it in `afterAll`, in reverse order, swallowing 404s.
- Cross-agent isolation tests must use *valid* inputs. Do not rely on invalid-input failures to prove authorization.
- Retry reads that depend on Todoist's eventual consistency; assert the exact success condition.

## Review Checklist

Before merging, verify:

- Does the auth logic honor explicit `agentId` selection exactly?
- Could this change accidentally collapse a secondary-agent call onto the default token?
- Is every newly registered tool documented in `README.md` and scoped with a clear description?
- Do new destructive tools require an explicit id, with no filter/bulk path?
- Does CI pass: lint, build, test?
