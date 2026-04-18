# AGENTS.md

Rules for AI agents working on this codebase.

## Our Way — How We Do Stuff

### Live-API Testing (non-negotiable)

Tests run against the real Todoist API. There are no mocks, no stubs, no mocked SDK responses. What we ship is what gets tested against the actual API.

**Never modify or delete pre-existing workspace data.** This is the hard rule. The Todoist workspace contains real tasks and projects that belong to you. Tests must not touch them. The pattern is always:

1. **Create** whatever resources the test needs
2. **Run assertions** against what you created
3. **Delete** what you created when the test finishes — including on failure
4. **Swallow 404s** on cleanup — already-gone is fine; don't let cleanup failures fail the suite

If a test needs a specific task state (e.g. a completed task to test reopening), create the task from scratch, complete it, reopen it, then delete it. Do not repurpose or borrow an existing task.

### No Secrets on Forks

CI never reads `TODOIST_API_TOKEN` on pull requests from forked repos. The `build` job has an `if` guard that skips the entire job (including test step) on external PRs. No API key should ever reach an untrusted CI run. The key lives in GitHub repo secrets and is set by Wretch when shipping a new plugin.

### API Key Management

When building a new plugin that uses a third-party API:

1. Write the test suite first (before CI has the key)
2. After tests are written and clean, Wretch adds the API key to the repo's GitHub secrets via `gh secret set`
3. CI takes it from there on every subsequent push

### Code style

- All exports need TSDoc docstrings.
- Comments explain *why*, not *what*.
- Run `pnpm lint:fix && pnpm build` before committing.
- Run `pnpm lint` to verify clean.

## Tests

Live-API suite — every test hits the real Todoist API.

**Setup:** Track every created resource id in a module-level array (`created: {id, kind}[]`).

**Teardown (`afterAll`):** Delete in reverse order (children before parents). Swallow 404s. Log non-404 cleanup failures as warnings but don't fail the suite.

**Coverage:**
- `getProjects()` → at least one result with `id` + `name`
- `addTask` → returns task with `id`; full field set works
- `getTask` → round-trips by id correctly
- `updateTask` → patch applies, other fields preserved
- `quickAddTask` → parses natural language, returns task
- `closeTask` → marks complete, re-read confirms `isCompleted: true`
- `reopenTask` → moves completed task back to active
- `deleteTask` → removes task, subsequent `getTask` throws
- `getLabels` → returns array (empty is valid for label-free accounts)
- Auth → bogus agentId throws (does not silently fall back)

## Tool registration rules

- Use snake_case param names in TypeBox schemas (agent-facing surface)
- Map snake_case → camelCase inside `execute()` before calling the SDK
- Destructive tools (`delete_task`, `delete_project`) require an explicit `id` param. Never add a filter-based bulk delete path.
- Wrap every SDK response with `jsonResult()` before returning.
- Use `compact()` to strip `undefined` fields from param objects before passing to the SDK.