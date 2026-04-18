import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "todoist");
const DEFAULT_KEY_PATH = path.join(CONFIG_DIR, "api_key");

/**
 * Resolve the Todoist API token for a given agent.
 *
 * Resolution order:
 *   1. If `agentId` is provided, read `~/.config/todoist/api_key_<agentId>`.
 *      The agent-scoped path is strict: if the file is missing or unreadable,
 *      this function throws. It never silently falls back to the default
 *      token, because isolation between agents must not collapse by accident.
 *   2. Otherwise (no `agentId`), read `process.env.TODOIST_API_TOKEN`. The
 *      OpenClaw gateway loads `~/.openclaw/.env` into its process env.
 *   3. If the env var is missing, fall back to `~/.config/todoist/api_key`.
 *   4. If none of the above resolve, throw an error naming every path tried.
 *
 * @param agentId Optional OpenClaw agent identifier for per-agent tokens.
 * @returns The trimmed Todoist API token.
 * @throws When no token can be resolved for the requested scope.
 */
export function getTodoistToken(agentId?: string): string {
  if (agentId) {
    const agentKeyPath = path.join(CONFIG_DIR, `api_key_${agentId}`);
    try {
      return fs.readFileSync(agentKeyPath, "utf8").trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read Todoist API token for agent "${agentId}" from ${agentKeyPath}: ${message}. ` +
          "Agent-scoped tokens do not fall back to the default token."
      );
    }
  }

  const envToken = process.env.TODOIST_API_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  try {
    return fs.readFileSync(DEFAULT_KEY_PATH, "utf8").trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve Todoist API token. Tried: process.env.TODOIST_API_TOKEN, ${DEFAULT_KEY_PATH}. ` +
        `Last error: ${message}`
    );
  }
}
