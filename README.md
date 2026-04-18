# openclaw-todoist

> Native Todoist integration for OpenClaw — 12 typed tools backed by the official Todoist API.

## About

Gives OpenClaw agents direct, authenticated access to Todoist — task creation, project management, natural-language quick add, and full task lifecycle control. No middleware, no Zapier, no IFTTT. Just the API.

Uses [`@doist/todoist-sdk`](https://www.npmjs.com/package/@doist/todoist-sdk) (API version 9) internally. Tools are registered via OpenClaw's plugin entry point and are available to all agents in the gateway.

## Installation

```bash
pnpm install
pnpm build
```

Link the plugin into your local OpenClaw install:

```bash
ln -s "$PWD" ~/.openclaw/extensions/todoist
```

Add `"todoist"` to `plugins.allow` in `~/.openclaw/openclaw.json` and restart the gateway.

## Configuration

The plugin reads the Todoist token in this order — first hit wins:

| Priority | Source | When to use |
|----------|--------|-------------|
| 1 | `~/.config/todoist/api_key_<agentId>` | Agent-scoped token (e.g. Esther's agent has its own key) |
| 2 | `TODOIST_API_TOKEN` env var | Default. OpenClaw loads `~/.openclaw/.env` into the gateway |
| 3 | `~/.config/todoist/api_key` | Fallback default token |

If an agent-scoped file is requested but missing, the tool call fails. It will **not** silently fall back to the default token.

## Tools

### Task lifecycle

| Tool | Description |
|------|-------------|
| `todoist_list_tasks` | List active tasks. Supports filtering by project, section, parent, label, or Todoist filter string (`today`, `overdue`, `p1 & 7 days`). |
| `todoist_get_task` | Retrieve a single active task by id. |
| `todoist_create_task` | Create a task with full structured fields. Use `todoist_quick_add` for natural-language input instead. |
| `todoist_quick_add` | Create a task from a natural-language string. Supports `#project`, `@label`, due phrases (`tomorrow 9am`), and priority flags (`p1`–`p4`). |
| `todoist_update_task` | Patch any field on an existing task. Only the fields you pass are updated. |
| `todoist_complete_task` | Mark a task as complete (close it). |
| `todoist_reopen_task` | Reopen a previously completed task. |
| `todoist_delete_task` | Permanently delete a task by id. Destructive — requires an explicit id. No filter-based bulk delete. |

### Projects

| Tool | Description |
|------|-------------|
| `todoist_list_projects` | List every project including Inbox. |
| `todoist_create_project` | Create a new project with optional color and parent (nesting). |
| `todoist_delete_project` | Permanently delete a project by id. Destructive — requires an explicit id. |

### Labels

| Tool | Description |
|------|-------------|
| `todoist_list_labels` | List personal labels in the workspace. |

## Development

```bash
pnpm lint       # Biome check (lint + format)
pnpm lint:fix   # Biome check + autofix
pnpm build      # tsc → dist/
pnpm test       # vitest run — hits live Todoist API, requires TODOIST_API_TOKEN
```

### SDK quirks (important)

The Todoist SDK v9 has some behaviors that differ from the type signatures:

- **`closeTask`/`reopenTask`/`deleteTask` return `undefined`**, not `boolean` — the Todoist API returns an empty object `{}` for these. Assert on state side-effects instead (re-read the task and check `completedAt` or `isDeleted`).
- **`isCompleted` field is always `undefined`** on task objects even after a task is closed. Use `completedAt !== null` to detect completed state.
- **`deleteTask` does not throw** on a soft-deleted task — it returns the task object with `isDeleted: true`. Subsequent `getTask` calls succeed and return the marked task.

These quirks are reflected in the test suite. If you add tools that interact with task state, test the same way.

### CI

CI runs `install → lint → build → test` on every PR into `main`. The test step only runs on PRs from this repository — API keys never reach forked PRs. `TODOIST_API_TOKEN` is stored as a GitHub Actions secret.

## License

ISC
