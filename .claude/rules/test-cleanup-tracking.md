---
description: "Always track test-created resources for afterAll cleanup"
globs: ["test/**/*.ts"]
---

# Test Cleanup Tracking

Every resource created during a test must be registered with `track(id, kind)` for
afterAll cleanup, even if the test plans to delete it.

## Why

If the test aborts between creation and deletion (assertion failure, timeout, SDK
error), untracked resources leak into the live Todoist workspace. The cleanup logic
already swallows 404s, so double-deletion is safe.

## Rule

```ts
// Bad — skips tracking because "we delete it later"
const task = await client.addTask({ content: "will delete" });
await client.deleteTask(task.id);

// Good — tracked before deletion attempt
const task = await client.addTask({ content: "will delete" });
track(task.id, "task");
await client.deleteTask(task.id);
```
