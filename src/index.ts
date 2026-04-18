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
    api.registerTool((_ctx) => ({
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
      async execute(id, params) {
        const client = getClient(id);
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
    }));

    // --- todoist_get_task ---
    api.registerTool((_ctx) => ({
      name: "todoist_get_task",
      label: "Todoist Get Task",
      description: "Retrieve a single active task by its id.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(id, params) {
        return jsonResult(await getClient(id).getTask(params.id));
      },
    }));

    // --- todoist_create_task ---
    api.registerTool((_ctx) => ({
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
      async execute(id, params) {
        const task = await getClient(id).addTask(
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
    }));

    // --- todoist_quick_add ---
    api.registerTool((_ctx) => ({
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
      async execute(id, params) {
        const task = await getClient(id).quickAddTask({ text: params.text });
        return jsonResult(task);
      },
    }));

    // --- todoist_update_task ---
    api.registerTool((_ctx) => ({
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
      async execute(id, params) {
        const task = await getClient(id).updateTask(
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
          }) as Parameters<TodoistApi["addTask"]>[0]
        );
        return jsonResult(task);
      },
    }));

    // --- todoist_complete_task ---
    api.registerTool((_ctx) => ({
      name: "todoist_complete_task",
      label: "Todoist Complete Task",
      description: "Mark a task as complete (closed).",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(id, params) {
        const ok = await getClient(id).closeTask(params.id);
        return jsonResult({ id: params.id, closed: ok });
      },
    }));

    // --- todoist_reopen_task ---
    api.registerTool((_ctx) => ({
      name: "todoist_reopen_task",
      label: "Todoist Reopen Task",
      description: "Reopen a previously completed task.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id." }),
      }),
      async execute(id, params) {
        const ok = await getClient(id).reopenTask(params.id);
        return jsonResult({ id: params.id, reopened: ok });
      },
    }));

    // --- todoist_delete_task ---
    // Destructive: explicit id only. Never add a filter-based bulk delete here.
    api.registerTool((_ctx) => ({
      name: "todoist_delete_task",
      label: "Todoist Delete Task",
      description:
        "Permanently delete a task by id. Destructive — requires an explicit id; bulk/filter deletes are not supported.",
      parameters: Type.Object({
        id: Type.String({ description: "The task id to delete." }),
      }),
      async execute(id, params) {
        const ok = await getClient(id).deleteTask(params.id);
        return jsonResult({ id: params.id, deleted: ok });
      },
    }));

    // --- todoist_list_projects ---
    api.registerTool((_ctx) => ({
      name: "todoist_list_projects",
      label: "Todoist List Projects",
      description: "List every project in the workspace (Inbox + user projects).",
      parameters: Type.Object({}),
      async execute(id, _params) {
        return jsonResult(await getClient(id).getProjects());
      },
    }));

    // --- todoist_create_project ---
    api.registerTool((_ctx) => ({
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
      async execute(id, params) {
        const project = await getClient(id).addProject(
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
    }));

    // --- todoist_delete_project ---
    // Destructive: explicit id only. Never add a filter-based bulk delete here.
    api.registerTool((_ctx) => ({
      name: "todoist_delete_project",
      label: "Todoist Delete Project",
      description:
        "Permanently delete a project by id. Destructive — requires an explicit id; bulk/filter deletes are not supported.",
      parameters: Type.Object({
        id: Type.String({ description: "The project id to delete." }),
      }),
      async execute(id, params) {
        const ok = await getClient(id).deleteProject(params.id);
        return jsonResult({ id: params.id, deleted: ok });
      },
    }));

    // --- todoist_list_labels ---
    api.registerTool((_ctx) => ({
      name: "todoist_list_labels",
      label: "Todoist List Labels",
      description: "List personal labels in the workspace.",
      parameters: Type.Object({}),
      async execute(id, _params) {
        return jsonResult(await getClient(id).getLabels());
      },
    }));
  },
});

export { getClient, jsonResult };
