import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoistApi } from "@doist/todoist-sdk";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTodoistToken } from "../src/auth.js";

/**
 * Live-API test suite for openclaw-todoist.
 *
 * Guardrails:
 * - Tests run against the REAL Todoist API — no mocks, no stubs.
 * - Tests NEVER modify or delete pre-existing data in the workspace.
 *   Every test creates its own resources and cleans them up afterward.
 * - Auth tests use a bogus agentId to confirm that invalid agent files
 *   do NOT silently fall back to the default token.
 * - All created task/project ids are tracked and deleted in afterAll.
 *   Deletion errors (404s) are swallowed — the goal is idempotent cleanup.
 */

function resolveLiveToken(): string | undefined {
  try {
    return getTodoistToken();
  } catch {
    return undefined;
  }
}

const liveToken = resolveLiveToken();
const liveDescribe = liveToken ? describe : describe.skip;
const client = liveToken ? new TodoistApi(liveToken) : undefined;

function liveClient(): TodoistApi {
  if (!client) {
    throw new Error("Todoist live API token is not configured.");
  }
  return client;
}

interface CreatedResource {
  id: string;
  kind: "task" | "project";
}

const created: CreatedResource[] = [];

// Add a resource to the cleanup queue. Safe to call multiple times.
function track(id: string, kind: "task" | "project") {
  created.push({ id, kind });
}

// Idempotent cleanup: swallow 404s, delete in reverse order.
afterAll(async () => {
  if (!client) return;
  // Reverse order — children before parents.
  for (const resource of [...created].reverse()) {
    try {
      if (resource.kind === "task") {
        await client.deleteTask(resource.id);
      } else {
        await client.deleteProject(resource.id);
      }
    } catch (err: unknown) {
      // Swallow 404 — already gone is fine.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("404")) {
        console.warn(`cleanup ${resource.kind} ${resource.id}: ${msg}`);
      }
    }
  }
});

// --- Projects ---

liveDescribe("todoist_list_projects", () => {
  it("returns at least one project with id and name", async () => {
    const result = await liveClient().getProjects();
    expect(result.results.length).toBeGreaterThan(0);
    for (const project of result.results) {
      expect(project.id).toBeDefined();
      expect(project.name).toBeDefined();
    }
  });
});

// --- Tasks (create → read → update → complete/reopen/delete) ---

liveDescribe("todoist_create_task", () => {
  it("addTask creates a task and returns it with an id", async () => {
    const task = await liveClient().addTask({ content: "openclaw-todoist test task" });
    track(task.id, "task");
    expect(task.id).toBeDefined();
    expect(task.content).toBe("openclaw-todoist test task");
  });

  it("addTask accepts full structured fields", async () => {
    const task = await liveClient().addTask({
      content: "structured fields test",
      description: "a description",
      priority: 3,
    });
    track(task.id, "task");
    expect(task.id).toBeDefined();
    expect(task.description).toBe("a description");
    expect(task.priority).toBe(3);
  });
});

liveDescribe("todoist_get_task", () => {
  it("getTask returns the correct task by id", async () => {
    const created = await liveClient().addTask({ content: "getTask round-trip test" });
    track(created.id, "task");

    const fetched = await liveClient().getTask(created.id);
    expect(fetched.content).toBe("getTask round-trip test");
  });
});

liveDescribe("todoist_update_task", () => {
  it("updateTask applies a priority patch", async () => {
    const task = await liveClient().addTask({ content: "priority patch test" });
    track(task.id, "task");

    await liveClient().updateTask(task.id, { priority: 4 });
    const updated = await liveClient().getTask(task.id);
    expect(updated.priority).toBe(4);
  });

  it("updateTask preserves other fields", async () => {
    const task = await liveClient().addTask({
      content: "field preservation test",
      description: "original",
    });
    track(task.id, "task");

    await liveClient().updateTask(task.id, { priority: 1 });
    const updated = await liveClient().getTask(task.id);
    expect(updated.content).toBe("field preservation test");
    expect(updated.description).toBe("original");
  });
});

liveDescribe("todoist_quick_add", () => {
  it("quickAddTask parses natural language and returns a task", async () => {
    const task = await liveClient().quickAddTask({ text: "OpenClaw smoke test via quickAddTask" });
    track(task.id, "task");
    expect(task.id).toBeDefined();
    expect(task.content).toBe("OpenClaw smoke test via quickAddTask");
  });
});

liveDescribe("todoist_complete_task", () => {
  it("closeTask marks a task as completed", async () => {
    const task = await liveClient().addTask({ content: "complete test task" });
    track(task.id, "task");

    // closeTask returns void on the SDK — state change is the signal.
    await liveClient().closeTask(task.id);

    // Re-read to confirm completedAt is now set.
    const reloaded = await liveClient().getTask(task.id);
    expect(reloaded.completedAt).not.toBeNull();
  });
});

liveDescribe("todoist_reopen_task", () => {
  it("reopenTask moves a completed task back to active", async () => {
    const task = await liveClient().addTask({ content: "reopen test task" });
    track(task.id, "task");

    await liveClient().closeTask(task.id);
    const closed = await liveClient().getTask(task.id);
    expect(closed.completedAt).not.toBeNull();

    // reopenTask returns void on the SDK — state change is the signal.
    await liveClient().reopenTask(task.id);

    const reopened = await liveClient().getTask(task.id);
    expect(reopened.completedAt).toBeNull();
  });
});

liveDescribe("todoist_delete_task", () => {
  it("deleteTask removes the task and subsequent getTask returns isDeleted: true", async () => {
    const task = await liveClient().addTask({ content: "delete me test task" });
    // Intentionally NOT tracked — we're deleting it.

    await liveClient().deleteTask(task.id);

    // Subsequent getTask returns the task with isDeleted: true — Todoist API
    // does not throw on a soft-deleted task, it marks it as deleted.
    const reloaded = await liveClient().getTask(task.id);
    expect(reloaded.isDeleted).toBe(true);
  });
});

// --- Labels ---

liveDescribe("todoist_list_labels", () => {
  it("getLabels returns an array (empty is valid for accounts without labels)", async () => {
    const result = await liveClient().getLabels();
    expect(Array.isArray(result.results)).toBe(true);
  });
});

// --- Auth ---

// --- Batch operations ---

describe("todoist_create_tasks (batch)", () => {
  it("creates multiple tasks and returns per-item results", async () => {
    const items = [
      { content: "batch-create-1" },
      { content: "batch-create-2", priority: 3 },
      { content: "batch-create-3", description: "batch desc" },
    ];
    const results = [];
    for (const item of items) {
      const task = await client.addTask(item);
      track(task.id, "task");
      results.push(task);
    }
    expect(results).toHaveLength(3);
    for (const task of results) {
      expect(task.id).toBeDefined();
    }
    expect(results[1].priority).toBe(3);
    expect(results[2].description).toBe("batch desc");
  });
});

describe("todoist_complete_tasks (batch)", () => {
  it("completes multiple tasks", async () => {
    const t1 = await client.addTask({ content: "batch-complete-1" });
    const t2 = await client.addTask({ content: "batch-complete-2" });
    track(t1.id, "task");
    track(t2.id, "task");

    await client.closeTask(t1.id);
    await client.closeTask(t2.id);

    const r1 = await client.getTask(t1.id);
    const r2 = await client.getTask(t2.id);
    expect(r1.completedAt).not.toBeNull();
    expect(r2.completedAt).not.toBeNull();
  });
});

describe("todoist_update_tasks (batch)", () => {
  it("patches multiple tasks", async () => {
    const t1 = await client.addTask({ content: "batch-update-1" });
    const t2 = await client.addTask({ content: "batch-update-2" });
    track(t1.id, "task");
    track(t2.id, "task");

    await client.updateTask(t1.id, { priority: 4 });
    await client.updateTask(t2.id, { content: "batch-update-2-renamed" });

    const r1 = await client.getTask(t1.id);
    const r2 = await client.getTask(t2.id);
    expect(r1.priority).toBe(4);
    expect(r2.content).toBe("batch-update-2-renamed");
  });
});

describe("todoist_delete_tasks (batch)", () => {
  it("deletes multiple tasks", async () => {
    const t1 = await client.addTask({ content: "batch-delete-1" });
    const t2 = await client.addTask({ content: "batch-delete-2" });
    // Track for cleanup in case the test aborts before the delete calls succeed.
    track(t1.id, "task");
    track(t2.id, "task");

    await client.deleteTask(t1.id);
    await client.deleteTask(t2.id);

    const r1 = await client.getTask(t1.id);
    const r2 = await client.getTask(t2.id);
    expect(r1.isDeleted).toBe(true);
    expect(r2.isDeleted).toBe(true);
  });
});

// --- Auth ---

describe("auth", () => {
  const originalToken = process.env.TODOIST_API_TOKEN;
  const originalConfigDir = process.env.TODOIST_CONFIG_DIR;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.TODOIST_API_TOKEN;
    } else {
      process.env.TODOIST_API_TOKEN = originalToken;
    }
    if (originalConfigDir === undefined) {
      delete process.env.TODOIST_CONFIG_DIR;
    } else {
      process.env.TODOIST_CONFIG_DIR = originalConfigDir;
    }
  });

  it("default and main contexts may resolve via env fallback", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "todoist-auth-"));
    process.env.TODOIST_CONFIG_DIR = tempDir;
    process.env.TODOIST_API_TOKEN = "todoist_env_test_token";

    expect(getTodoistToken()).toBe("todoist_env_test_token");
    expect(getTodoistToken("default")).toBe("todoist_env_test_token");
    expect(getTodoistToken("main")).toBe("todoist_env_test_token");
  });

  it("explicit non-main agents do not fall back to the env token", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "todoist-auth-"));
    process.env.TODOIST_CONFIG_DIR = tempDir;
    process.env.TODOIST_API_TOKEN = "todoist_env_test_token";

    expect(() => getTodoistToken("secondary_agent")).toThrow("Explicit non-main agents");
  });

  it("explicit non-main agents use their own key file when present", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "todoist-auth-"));
    process.env.TODOIST_CONFIG_DIR = tempDir;
    process.env.TODOIST_API_TOKEN = "todoist_env_test_token";
    writeFileSync(join(tempDir, "api_key_secondary_agent"), "todoist_secondary_test_token");

    expect(getTodoistToken("secondary_agent")).toBe("todoist_secondary_test_token");
  });

  it("main context can resolve via fallback default key file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "todoist-auth-"));
    process.env.TODOIST_CONFIG_DIR = tempDir;
    delete process.env.TODOIST_API_TOKEN;
    writeFileSync(join(tempDir, "api_key"), "todoist_default_file_test_token");

    expect(getTodoistToken("main")).toBe("todoist_default_file_test_token");
  });

  it("throws with useful details when no main/default paths are available", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "todoist-auth-"));
    process.env.TODOIST_CONFIG_DIR = tempDir;
    delete process.env.TODOIST_API_TOKEN;

    expect(() => getTodoistToken("main")).toThrow("process.env.TODOIST_API_TOKEN");
  });
});
