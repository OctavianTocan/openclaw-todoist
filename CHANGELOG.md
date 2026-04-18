# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-19

### Added

- **12 native tools** for Todoist task and project management:
  - `todoist_list_tasks` — list active tasks with optional filter/sort/pagination
  - `todoist_get_task` — retrieve a single active task by id
  - `todoist_create_task` — create a task with full structured fields
  - `todoist_quick_add` — natural-language parser (supports `#project`, `@label`, due strings, `p1-p4`)
  - `todoist_update_task` — patch any field on an existing task
  - `todoist_complete_task` — mark a task as complete
  - `todoist_reopen_task` — reopen a completed task
  - `todoist_delete_task` — permanently delete a task (explicit id required)
  - `todoist_list_projects` — list all projects including Inbox
  - `todoist_create_project` — create a new project
  - `todoist_delete_project` — permanently delete a project (explicit id required)
  - `todoist_list_labels` — list personal labels
- **Live-API test suite** (13 tests, all against the real Todoist API)
- **GitHub Actions CI** with fork-gated test step
- **SDK quirks documented** — `isCompleted` is `undefined` in v9, use `completedAt`; `closeTask`/`reopenTask`/`deleteTask` return `undefined`, assert on state side-effects
