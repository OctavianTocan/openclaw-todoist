---
description: "Type casts must reference the correct SDK method's parameter type"
globs: ["src/**/*.ts"]
---

# Accurate Type Casts

When casting `compact()` output for the Todoist SDK, use the parameter type from the
**actual method being called**, not a similar-looking one.

## Rule

`updateTask` and `addTask` have different parameter shapes. Cast to the correct one:

```ts
// Bad — addTask type on an updateTask call
client.updateTask(id, compact({...}) as Parameters<TodoistApi["addTask"]>[0]);

// Good — updateTask's second parameter
client.updateTask(id, compact({...}) as Parameters<TodoistApi["updateTask"]>[1]);
```

The `[1]` index is because `updateTask(id, params)` takes the task ID as the first
argument and the update payload as the second.
