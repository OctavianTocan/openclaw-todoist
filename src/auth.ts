import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the Todoist API token for a given agent.
 *
 * Resolution order:
 * 1. If agentId provided: check ~/.config/todoist/api_key_<agentId> — if readable, trim + return
 * 2. For default/main only: read TODOIST_API_TOKEN from process.env
 * 3. For default/main only: check ~/.config/todoist/api_key if env missing
 * 4. Throw a precise error naming every path tried
 *
 * Do NOT silently fall back from explicit non-main agents to the default token.
 */
export function getTodoistToken(agentId?: string): string {
  const configDir = process.env.TODOIST_CONFIG_DIR ?? join(homedir(), ".config", "todoist");
  const normalizedAgentId = agentId === "default" ? undefined : agentId;

  // Step 1: agent-specific token file
  if (normalizedAgentId) {
    const agentKeyPath = join(configDir, `api_key_${normalizedAgentId}`);
    try {
      const token = readFileSync(agentKeyPath, "utf8").trim();
      if (token) return token;
    } catch {
      // File not readable — continue to next step
    }
  }

  const isMainContext = normalizedAgentId === undefined || normalizedAgentId === "main";
  if (!isMainContext) {
    throw new Error(
      `Could not resolve Todoist token for agent "${normalizedAgentId}".\n` +
        `Tried:\n` +
        `  - ${join(configDir, `api_key_${normalizedAgentId}`)}: not readable or empty\n` +
        `Explicit non-main agents do not fall back to TODOIST_API_TOKEN or ${join(configDir, "api_key")}.`
    );
  }

  // Step 2: environment variable (OpenClaw loads ~/.openclaw/.env into process.env)
  const envToken = process.env.TODOIST_API_TOKEN;
  if (envToken) return envToken;

  // Step 3: fallback default key file
  const defaultKeyPath = join(configDir, "api_key");
  try {
    const token = readFileSync(defaultKeyPath, "utf8").trim();
    if (token) return token;
  } catch {
    // File not readable — continue to error
  }

  // Step 4: nothing worked — throw with full accounting
  const tried: string[] = [];
  if (normalizedAgentId) {
    const agentKeyPath = join(configDir, `api_key_${normalizedAgentId}`);
    tried.push(`  - ${agentKeyPath}: not readable or empty`);
  }
  tried.push(`  - process.env.TODOIST_API_TOKEN: not set or empty`);
  tried.push(`  - ${join(configDir, "api_key")}: not readable or empty`);

  throw new Error(
    `Could not resolve Todoist token for agent${normalizedAgentId ? ` "${normalizedAgentId}"` : ""}.\n` +
      `Tried:\n${tried.join("\n")}`
  );
}
