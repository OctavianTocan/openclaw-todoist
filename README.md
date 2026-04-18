# openclaw-todoist

> Native Todoist tools for OpenClaw agents — tasks, projects, labels, and natural-language quick add.

## Features

A single OpenClaw plugin that exposes the Todoist REST v1 surface as 12 typed tools, backed by the official [`@doist/todoist-sdk`](https://www.npmjs.com/package/@doist/todoist-sdk).

## Installation

```bash
pnpm install
pnpm build
```

Then link the plugin into your local OpenClaw install (matches the pattern used by `openclaw-notion`):

```bash
ln -s "$PWD" ~/.openclaw/extensions/todoist
```

Add `"todoist"` to `plugins.allow` in `~/.openclaw/openclaw.json` and restart the gateway.

## Configuration

The plugin reads the Todoist token in this order:

1. **Agent-scoped token file** — `~/.config/todoist/api_key_<agentId>`. Used only when a tool is invoked with an explicit `agentId`. If the file is missing, the call fails — it will never silently fall back to the default token.
2. **Environment variable** — `TODOIST_API_TOKEN` (OpenClaw loads `~/.openclaw/.env` into the gateway).
3. **Default token file** — `~/.config/todoist/api_key`.

## Tools

| Tool | Description |
|------|-------------|
| `todoist_list_tasks` | List active tasks with optional project / section / parent / label / filter scope. |
| `todoist_get_task` | Retrieve a single task by id. |
| `todoist_create_task` | Create a task using structured fields (content, project, labels, priority, due). |
| `todoist_quick_add` | Create a task from a natural-language string (`#project`, `@label`, due phrases). |
| `todoist_update_task` | Patch an existing task; only provided fields are updated. |
| `todoist_complete_task` | Close (complete) a task. |
| `todoist_reopen_task` | Reopen a previously completed task. |
| `todoist_delete_task` | Permanently delete a task by id. Destructive — no bulk/filter variant. |
| `todoist_list_projects` | List every project in the workspace. |
| `todoist_create_project` | Create a new project. |
| `todoist_delete_project` | Permanently delete a project by id. Destructive — no bulk/filter variant. |
| `todoist_list_labels` | List personal labels. |

## Development

```bash
pnpm lint       # Biome check (lint + format)
pnpm lint:fix   # Biome check + autofix
pnpm format     # Biome format --write
pnpm build      # tsc → dist/
pnpm test       # vitest run (live Todoist API — requires TODOIST_API_TOKEN)
```

CI (`.github/workflows/ci.yml`) runs `install → lint → build → test` on every PR into `main`.

## License

ISC
