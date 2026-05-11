import { TodoistApi } from "@doist/todoist-sdk";
import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { getTodoistToken } from "./auth.js";

/**
 * Per-agent Todoist client cache. Each agentId (or "default") gets its own
 * `TodoistApi` instance backed by its own token, so agents cannot cross
 * workspaces through a shared client.
 */
const clients = new Map<string, TodoistApi>();

function createClient(agentId?: string): TodoistApi {
  return new TodoistApi(getTodoistToken(agentId));
}

function getClient(agentId?: string): TodoistApi {
  const cacheKey = agentId || "default";
  let client = clients.get(cacheKey);
  if (!client) {
    client = createClient(agentId);
    clients.set(cacheKey, client);
  }
  return client;
}

/** Wrap any SDK response into the OpenClaw tool-result envelope. */
function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
    details: null,
  };
}

/** Per-item result shape returned by batch tools. */
interface BatchResult {
  id?: string;
  status: "ok" | "error";
  content?: string;
  action?: string;
  error?: string;
}

/** Strip undefined fields from a record. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export default definePluginEntry({
  id: "todoist",
  name: "Todoist",
  description:
    "Native Todoist tools for OpenClaw agents: tasks, projects, labels, and natural-language quick add.",
  register(api) {
    // Drop cached clients on reload so every agent re-reads its token.
    clients.clear();

    // --- todoist_list_tasks ---
    api.registerTool((ctx) => ({
      name: "todoist_list_tasks",
      label: "Todoist List Tasks",
      description:
        "List active tasks. Supports filtering by project, section, parent, label, or natural-language filter (e.g. 'today', 'overdue').",
      parameters: Type.Object({
        project_id: Type.Optional(
          Type.String({ description: "Restrict results to a single project." })
        ),
        section_id: Type.Optional(
          Type.String({ description: "Restrict results to a single section." })
        ),
        parent_id: Type.Optional(
          Type.String({ description: "Restrict results to subtasks of this parent task." })
        ),
        label: Type.Optional(
          Type.String({ description: "Restrict results to tasks with this label name." })
        ),
        filter: Type.Optional(
          Type.String({
            description: "Todoist filter query (e.g. 'today', 'overdue', 'p1 & 7 days').",
          })
        ),
        limit: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: 200,
            description: "Maximum number of tasks to return. SDK paginates internally.",
          })
        ),
      }),
      async execute(_id, params) {
        const client = getClient(ctx.agentId);
        // Use filter endpoint when a natural-language filter is provided.
        if (params.filter) {
          const result = await client.getTasksByFilter({ query: params.filter });
          return jsonResult(result);
        }
        const result = await client.getTasks(
          compact({
            projectId: params.project_id,
            sectionId: params.section_id,
            parentId: params.parent_id,
            label: params.label,
            limit: params.limit,
          })
        );
        return jsonResult(result);
      },
    }), { name: "todoist_list_tasks" });

    // --- todoist_get_task ---
    api.registerTool((ctx) => ({
      name: "todoist_get_task",
      label: "Todoist Get Task",
      description: "Retrieve a single active task by its id.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(_id, params) {
        return jsonResult(await getClient(ctx.agentId).getTask(params.id));
      },
    }), { name: "todoist_get_task" });

    // --- todoist_create_task ---
    api.registerTool((ctx) => ({
      name: "todoist_create_task",
      label: "Todoist Create Task",
      description:
        "Create a task with full structured fields. Use todoist_quick_add when you have a natural-language string instead.",
      parameters: Type.Object({
        content: Type.String({ description: "Task title / content." }),
        description: Type.Optional(
          Type.String({ description: "Longer task description (markdown supported)." })
        ),
        project_id: Type.Optional(Type.String()),
        section_id: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String()),
        labels: Type.Optional(Type.Array(Type.String())),
        priority: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: 4,
            description: "1 = lowest, 4 = highest (Todoist's p1).",
          })
        ),
        due_string: Type.Optional(
          Type.String({ description: "Natural-language due date ('tomorrow 5pm')." })
        ),
        due_date: Type.Optional(Type.String({ description: "YYYY-MM-DD date." })),
        due_datetime: Type.Optional(
          Type.String({ description: "RFC3339 datetime (UTC or offset)." })
        ),
        due_lang: Type.Optional(
          Type.String({ description: "Due-string language code, e.g. 'en'." })
        ),
        assignee_id: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const task = await getClient(ctx.agentId).addTask(
          compact({
            content: params.content,
            description: params.description,
            projectId: params.project_id,
            sectionId: params.section_id,
            parentId: params.parent_id,
            labels: params.labels,
            priority: params.priority,
            dueString: params.due_string,
            dueDate: params.due_date,
            dueDatetime: params.due_datetime,
            dueLang: params.due_lang,
            assigneeId: params.assignee_id,
          }) as Parameters<TodoistApi["addTask"]>[0]
        );
        return jsonResult(task);
      },
    }), { name: "todoist_create_task" });

    // --- todoist_quick_add ---
    api.registerTool((ctx) => ({
      name: "todoist_quick_add",
      label: "Todoist Quick Add",
      description:
        "Add a task using Todoist's natural-language parser (supports #project, @label, due strings, and priority flags).",
      parameters: Type.Object({
        text: Type.String({
          description:
            "Full natural-language task string, e.g. 'Pay rent tomorrow 9am #Finance @recurring p1'.",
        }),
      }),
      async execute(_id, params) {
        const task = await getClient(ctx.agentId).quickAddTask({ text: params.text });
        return jsonResult(task);
      },
    }), { name: "todoist_quick_add" });

    // --- todoist_update_task ---
    api.registerTool((ctx) => ({
      name: "todoist_update_task",
      label: "Todoist Update Task",
      description: "Patch an existing task. Only fields you pass are updated.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
        content: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        labels: Type.Optional(Type.Array(Type.String())),
        priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
        due_string: Type.Optional(Type.String()),
        due_date: Type.Optional(Type.String()),
        due_datetime: Type.Optional(Type.String()),
        due_lang: Type.Optional(Type.String()),
        assignee_id: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const task = await getClient(ctx.agentId).updateTask(
          params.id,
          compact({
            content: params.content,
            description: params.description,
            labels: params.labels,
            priority: params.priority,
            dueString: params.due_string,
            dueDate: params.due_date,
            dueDatetime: params.due_datetime,
            dueLang: params.due_lang,
            assigneeId: params.assignee_id,
          }) as Parameters<TodoistApi["updateTask"]>[1]
        );
        return jsonResult(task);
      },
    }), { name: "todoist_update_task" });

    // --- todoist_complete_task ---
    api.registerTool((ctx) => ({
      name: "todoist_complete_task",
      label: "Todoist Complete Task",
      description: "Mark a task as complete (closed).",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(_id, params) {
        const ok = await getClient(ctx.agentId).closeTask(params.id);
        return jsonResult({ id: params.id, closed: ok });
      },
    }), { name: "todoist_complete_task" });

    // --- todoist_reopen_task ---
    api.registerTool((ctx) => ({
      name: "todoist_reopen_task",
      label: "Todoist Reopen Task",
      description: "Reopen a previously completed task.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(_id, params) {
        const ok = await getClient(ctx.agentId).reopenTask(params.id);
        return jsonResult({ id: params.id, reopened: ok });
      },
    }), { name: "todoist_reopen_task" });

    // --- todoist_delete_task ---
    // Destructive: explicit id only. Never add a filter-based bulk delete here.
    api.registerTool((ctx) => ({
      name: "todoist_delete_task",
      label: "Todoist Delete Task",
      description:
        "Permanently delete a task by id. Destructive — requires an explicit id; bulk/filter deletes are not supported.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id to delete." }),
      }),
      async execute(_id, params) {
        const ok = await getClient(ctx.agentId).deleteTask(params.id);
        return jsonResult({ id: params.id, deleted: ok });
      },
    }), { name: "todoist_delete_task" });

    // --- todoist_create_tasks (batch) ---
    api.registerTool((_ctx) => ({
      name: "todoist_create_tasks",
      label: "Todoist Create Tasks (Batch)",
      description:
        "Create multiple tasks in one call. Each item accepts the same fields as todoist_create_task. Returns per-item results.",
      parameters: Type.Object({
        tasks: Type.Array(
          Type.Object({
            content: Type.String({ description: "Task title / content." }),
            description: Type.Optional(Type.String()),
            project_id: Type.Optional(Type.String()),
            section_id: Type.Optional(Type.String()),
            parent_id: Type.Optional(Type.String()),
            labels: Type.Optional(Type.Array(Type.String())),
            priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
            due_string: Type.Optional(Type.String()),
            due_date: Type.Optional(Type.String()),
            due_datetime: Type.Optional(Type.String()),
            due_lang: Type.Optional(Type.String()),
            assignee_id: Type.Optional(Type.String()),
          }),
          { description: "Array of task inputs to create." }
        ),
      }),
      async execute(id, params) {
        const client = getClient(id);
        const results: BatchResult[] = [];
        // Sequential to respect Todoist rate limits.
        for (const item of params.tasks) {
          try {
            const task = await client.addTask(
              compact({
                content: item.content,
                description: item.description,
                projectId: item.project_id,
                sectionId: item.section_id,
                parentId: item.parent_id,
                labels: item.labels,
                priority: item.priority,
                dueString: item.due_string,
                dueDate: item.due_date,
                dueDatetime: item.due_datetime,
                dueLang: item.due_lang,
                assigneeId: item.assignee_id,
              }) as Parameters<TodoistApi["addTask"]>[0]
            );
            results.push({ id: task.id, status: "ok", content: task.content });
          } catch (err: unknown) {
            results.push({
              status: "error",
              content: item.content,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return jsonResult(results);
      },
    }));

    // --- todoist_complete_tasks (batch) ---
    api.registerTool((_ctx) => ({
      name: "todoist_complete_tasks",
      label: "Todoist Complete Tasks (Batch)",
      description: "Mark multiple tasks as complete by their IDs. Returns per-item results.",
      parameters: Type.Object({
        ids: Type.Array(Type.String(), {
          description: "Array of task IDs to complete.",
        }),
      }),
      async execute(id, params) {
        const client = getClient(id);
        const results: BatchResult[] = [];
        for (const taskId of params.ids) {
          try {
            await client.closeTask(taskId);
            results.push({ id: taskId, status: "ok", action: "completed" });
          } catch (err: unknown) {
            results.push({
              id: taskId,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return jsonResult(results);
      },
    }));

    // --- todoist_update_tasks (batch) ---
    api.registerTool((_ctx) => ({
      name: "todoist_update_tasks",
      label: "Todoist Update Tasks (Batch)",
      description:
        "Patch multiple tasks in one call. Each item needs an id plus the fields to update. Returns per-item results.",
      parameters: Type.Object({
        tasks: Type.Array(
          Type.Object({
            id: Type.String({ description: "The task id." }),
            content: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            labels: Type.Optional(Type.Array(Type.String())),
            priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
            due_string: Type.Optional(Type.String()),
            due_date: Type.Optional(Type.String()),
            due_datetime: Type.Optional(Type.String()),
            due_lang: Type.Optional(Type.String()),
            assignee_id: Type.Optional(Type.String()),
          }),
          { description: "Array of task update objects." }
        ),
      }),
      async execute(id, params) {
        const client = getClient(id);
        const results: BatchResult[] = [];
        for (const item of params.tasks) {
          try {
            const task = await client.updateTask(
              item.id,
              compact({
                content: item.content,
                description: item.description,
                labels: item.labels,
                priority: item.priority,
                dueString: item.due_string,
                dueDate: item.due_date,
                dueDatetime: item.due_datetime,
                dueLang: item.due_lang,
                assigneeId: item.assignee_id,
              }) as Parameters<TodoistApi["updateTask"]>[1]
            );
            results.push({ id: task.id, status: "ok", content: task.content });
          } catch (err: unknown) {
            results.push({
              id: item.id,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return jsonResult(results);
      },
    }));

    // --- todoist_delete_tasks (batch) ---
    // Destructive: explicit IDs only. Never add a filter-based bulk delete path.
    api.registerTool((_ctx) => ({
      name: "todoist_delete_tasks",
      label: "Todoist Delete Tasks (Batch)",
      description:
        "Delete multiple tasks by their IDs. Todoist treats this as a soft-delete (tasks are marked isDeleted, not hard-removed). Requires explicit IDs; filter-based bulk deletes are not supported.",
      parameters: Type.Object({
        ids: Type.Array(Type.String(), {
          description: "Array of task IDs to delete.",
        }),
      }),
      async execute(id, params) {
        const client = getClient(id);
        const results: BatchResult[] = [];
        for (const taskId of params.ids) {
          try {
            await client.deleteTask(taskId);
            results.push({ id: taskId, status: "ok", action: "deleted" });
          } catch (err: unknown) {
            results.push({
              id: taskId,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return jsonResult(results);
      },
    }));

    // --- todoist_list_projects ---
    api.registerTool((ctx) => ({
      name: "todoist_list_projects",
      label: "Todoist List Projects",
      description: "List every project in the workspace (Inbox + user projects).",
      parameters: Type.Object({}),
      async execute(_id, _params) {
        return jsonResult(await getClient(ctx.agentId).getProjects());
      },
    }), { name: "todoist_list_projects" });

    // --- todoist_create_project ---
    api.registerTool((ctx) => ({
      name: "todoist_create_project",
      label: "Todoist Create Project",
      description: "Create a new project.",
      parameters: Type.Object({
        name: Type.String({ description: "Project name." }),
        parent_id: Type.Optional(Type.String({ description: "Parent project id for nesting." })),
        color: Type.Optional(
          Type.String({ description: "Todoist color key, e.g. 'berry_red', 'sky_blue'." })
        ),
        is_favorite: Type.Optional(Type.Boolean()),
        view_style: Type.Optional(
          Type.Union([Type.Literal("list"), Type.Literal("board")], {
            description: "Default view style in the Todoist UI.",
          })
        ),
      }),
      async execute(_id, params) {
        const project = await getClient(ctx.agentId).addProject(
          compact({
            name: params.name,
            parentId: params.parent_id,
            color: params.color as never,
            isFavorite: params.is_favorite,
            viewStyle: params.view_style as never,
          }) as Parameters<TodoistApi["addProject"]>[0]
        );
        return jsonResult(project);
      },
    }), { name: "todoist_create_project" });

    // --- todoist_delete_project ---
    // Destructive: explicit id only. Never add a filter-based bulk delete here.
    api.registerTool((ctx) => ({
      name: "todoist_delete_project",
      label: "Todoist Delete Project",
      description:
        "Permanently delete a project by id. Destructive — requires an explicit id; bulk/filter deletes are not supported.",
      parameters: Type.Object({
        id: Type.String({ description: "The project id to delete." }),
      }),
      async execute(_id, params) {
        const ok = await getClient(ctx.agentId).deleteProject(params.id);
        return jsonResult({ id: params.id, deleted: ok });
      },
    }), { name: "todoist_delete_project" });

    // --- todoist_list_labels ---
    api.registerTool((ctx) => ({
      name: "todoist_list_labels",
      label: "Todoist List Labels",
      description: "List personal labels in the workspace.",
      parameters: Type.Object({}),
      async execute(_id, _params) {
        return jsonResult(await getClient(ctx.agentId).getLabels());
      },
    }), { name: "todoist_list_labels" });
  },
});

export { getClient, jsonResult };
