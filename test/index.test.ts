import { describe, expect, it } from "vitest";

describe("openclaw-todoist (scaffold)", () => {
  it("scaffold sanity — the test harness runs", () => {
    expect(1 + 1).toBe(2);
  });

  it.skip("TODO(Phase 5): todoist_list_projects returns at least one project with id + name", () => {
    // Live-API test. Will use getTodoistToken() + TodoistApi.getProjects().
  });

  it.skip("TODO(Phase 5): addTask → getTask → closeTask flow round-trips a real task", () => {
    // Track created task id, assert content, close it, re-read to confirm closed state.
  });

  it.skip("TODO(Phase 5): quickAdd parses natural language and returns a task with a due date", () => {
    // Input: 'OpenClaw plugin smoke test #Inbox today' → expect due populated + projectId = Inbox.
  });

  it.skip("TODO(Phase 5): updateTask applies a priority patch", () => {
    // Set priority to 3, re-read task, confirm priority === 3.
  });

  it.skip("TODO(Phase 5): reopenTask moves a closed task back to active", () => {
    // Close then reopen, confirm isCompleted === false.
  });

  it.skip("TODO(Phase 5): deleteTask removes the task and subsequent getTask throws", () => {
    // Isolated case — after delete, getTask(id) must reject with a 404-equivalent.
  });

  it.skip("TODO(Phase 5): getLabels returns an array (may be empty for accounts without labels)", () => {
    // Shape check only: array, each element has id + name when present.
  });

  it.skip("TODO(Phase 5): auth — bogus agentId with no override file throws (does not fall back)", () => {
    // Per spec, agent-scoped tokens must NOT silently fall back to the default.
  });
});
