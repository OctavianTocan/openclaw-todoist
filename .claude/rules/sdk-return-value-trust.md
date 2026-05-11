---
description: "Never expose raw SDK return values as success flags in tool results"
globs: ["src/**/*.ts"]
---

# SDK Return Value Trust

The Todoist SDK lifecycle methods (`closeTask`, `reopenTask`, `deleteTask`, `deleteProject`)
return `undefined`, not a boolean success indicator. Exposing the raw return value as a
field like `{ closed: ok }` creates a misleading tool result where consumers read
`undefined` as a success flag.

## Rule

Discard the raw SDK return value for void-returning methods. Return an explicit
action string that communicates what happened:

```ts
// Bad — ok is undefined, so closed is always undefined
const ok = await client.closeTask(id);
return jsonResult({ id, closed: ok });

// Good — explicit action string
await client.closeTask(id);
return jsonResult({ id, action: "completed" });
```

If the SDK throws, the error propagates naturally. The absence of an error IS the
success signal — the `action` field is for the consumer's benefit, not a real boolean.
