---
description: "Batch tools must use a typed result interface"
globs: ["src/**/*.ts"]
---

# Batch Result Typing

Batch tool results arrays must be typed with an explicit interface. An untyped
`const results = []` becomes `any[]`, which lets mismatched fields slip through
without compile-time errors.

## Rule

Define a result interface and annotate the array:

```ts
interface BatchResult {
  id?: string;
  status: "ok" | "error";
  content?: string;
  action?: string;
  error?: string;
}

const results: BatchResult[] = [];
```

Each batch tool can narrow this further if needed, but the base shape must always
include `status` as the discriminator.
