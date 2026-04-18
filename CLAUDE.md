# OpenClaw Todoist Plugin — CLAUDE

> Onboarding notes for Claude Code sessions working in this repo.

## What this repo is

A single OpenClaw plugin that exposes 12 Todoist tools (tasks, projects, labels, quick add) to OpenClaw agents. Architecture mirrors `openclaw-notion`, with a polish layer: Biome, a real README, a CHANGELOG, and CI that gates merges.

## Golden rules

- **pnpm only.** Never run `npm`. The lockfile is `pnpm-lock.yaml`.
- **Biome only.** No ESLint, no Prettier. Format + lint = `pnpm lint` and `pnpm lint:fix`.
- **ESM only.** `"type": "module"`, import with `.js` extensions in source (node16 resolution).
- **Destructive tools take explicit IDs.** Never add a filter-based bulk delete to `todoist_delete_task` or `todoist_delete_project`. This is a hard rule.
- **Agent-scoped tokens never fall back.** If `getTodoistToken("some-agent")` cannot read `~/.config/todoist/api_key_some-agent`, it must throw — never reach for the default token.

## Layout

```
src/
  auth.ts        # token resolution (per-agent, env, default-file)
  index.ts       # definePluginEntry + 12 tool registrations
test/
  index.test.ts  # vitest live-API suite
```

Config: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `biome.json`, `vitest.config.ts`.
CI: `.github/workflows/ci.yml`.

## After every file write

```bash
pnpm lint:fix && pnpm build
```

If either step fails, stop and fix before moving on.

## Tests

Tests use the real Todoist API via `@doist/todoist-sdk`. They require `TODOIST_API_TOKEN` in the environment (or `~/.config/todoist/api_key`). Every created task/project must be tracked and deleted in `afterAll`.

## Style

- TypeBox schemas on tool params use `snake_case` (agent-friendly). The SDK uses `camelCase` — map inside `execute`.
- `jsonResult(value)` is the only tool-result wrapper. Don't invent a second one.
- Keep TSDoc on exports; keep inline comments for *why*, not *what*.
- Prefer small pure helpers over large branching blocks.

## Review checklist

- Auth: does the change honor explicit `agentId` isolation?
- Tools: does every new tool have a `label`, clear `description`, TypeBox `parameters`, and an `execute` body that returns `jsonResult(...)`?
- Destructive paths: still single-id only?
- CI: `pnpm lint && pnpm build && pnpm test` all green?
