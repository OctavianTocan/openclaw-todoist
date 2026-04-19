---
name: todoist
description: Use when the user mentions tasks, Todoist, todo list, to-do, what needs doing, what's on my list, add task, complete task, or any task management request.
---

# Todoist

**Always use the native Todoist tools.** Do not use Python scripts, shell curl, or any other method to interact with Todoist.

## Tools

### Tasks
- **`todoist_list_tasks`** — list active tasks. Supports filtering by `project_id`, `section_id`, `parent_id`, `label`, or a Todoist filter string (`today`, `overdue`, `p1 & 7 days`). Returns full task objects with id, content, priority, due, labels.
- **`todoist_get_task`** — retrieve a single active task by its UUID.
- **`todoist_create_task`** — create a task with structured fields (content, description, project, section, parent, labels, priority, due date/datetime/string). For natural-language input, use `todoist_quick_add` instead.
- **`todoist_quick_add`** — create a task from a natural-language string. Parses `#project`, `@label`, due phrases (`tomorrow 9am`), and priority flags (`p1`–`p4`). Example: `Write tests for the auth module p1 #OpenClaw`
- **`todoist_update_task`** — patch any field on an existing task. Only the fields you pass are updated; others are preserved.
- **`todoist_complete_task`** — mark a task as complete (close it).
- **`todoist_reopen_task`** — reopen a previously completed task.
- **`todoist_delete_task`** — permanently delete a task by its UUID.

### Projects
- **`todoist_list_projects`** — list every project including Inbox. Returns id, name, color, isArchived, isFavorite.

### Labels
- **`todoist_list_labels`** — list personal labels in the workspace.

## Routing

Tools automatically use the correct API key based on your agent identity. Each agent is isolated to its own Todoist workspace (separate API tokens per agent). No manual key handling needed. Cross-workspace access is blocked by design.

## Workflow

1. **Show tasks** → `todoist_list_tasks` with optional `project_id` or filter string
2. **Show projects** → `todoist_list_projects` — pick the project id, then list tasks within it
3. **Quick-add a task** → `todoist_quick_add` with a natural-language string
4. **Create a structured task** → `todoist_create_task` with explicit fields
5. **Mark done** → `todoist_complete_task` with the task UUID
6. **Reopen a task** → `todoist_reopen_task` with the task UUID
7. **Update a task** → `todoist_update_task` with the task UUID and the fields to change
8. **Delete a task** → `todoist_delete_task` with the task UUID
9. **Check labels** → `todoist_list_labels` to see what's available before adding labels
10. **Diagnose issues** → check SDK quirks below if task state seems wrong

## Priority mapping

Todoist uses integers 1–4 (P1 = highest urgency, P4 = no priority).

| Flag | Value | Meaning |
|------|-------|---------|
| `p1` | 1 | urgent |
| `p2` | 2 | high |
| `p3` | 3 | medium |
| `p4` | 4 | no priority (default) |

## Due date formats

`todoist_quick_add` handles natural language: `tomorrow`, `today`, `next monday`, `in 3 days`, `apr 20`, `tomorrow 9am`. `todoist_create_task` accepts explicit `due_date` (YYYY-MM-DD) or `due_datetime` (YYYY-MM-DDTHH:mm:ss) or `due_string`.

## SDK quirks (important)

The `@doist/todoist-sdk` v9 has behaviors that differ from the type signatures:

- **`closeTask`/`reopenTask`/`deleteTask` return `undefined`** — the Todoist API returns an empty object `{}`. Assert on state side-effects instead: re-read the task and check `completedAt !== null` (closed) or `completedAt === null` (reopened).
- **`isCompleted` is always `undefined`** on task objects even after closing. Do NOT use `task.isCompleted`. Use `completedAt !== null`.
- **`deleteTask` does not throw** on an already-deleted task — it returns the task object with `isDeleted: true`. Subsequent `getTask` calls still succeed and return the marked task.
- **Quick-add** returns the full task object; subsequent calls can retrieve it by id.

## Rules

- Never shell out to `curl`, `python`, or bash scripts for Todoist operations.
- Never use `web_fetch` on Todoist URLs — use the tools instead.
- Prefer `todoist_quick_add` for conversational task creation (faster, more natural).
- Destructive tools (`todoist_delete_task`) require an explicit UUID. No filter-based bulk delete.
- Always prefer direct tool calls over script-based workarounds.
- **Bulk operations:** All tools are single-task. For multi-task migration/editing, chain calls or write a script (see GitHub issue #1 for planned batch tooling).
