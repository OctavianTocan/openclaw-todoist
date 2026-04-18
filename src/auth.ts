import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the Todoist API token for a given agent.
 *
 * Resolution order:
 * 1. If agentId provided: check ~/.config/todoist/api_key_<agentId> — if readable, trim + return
 * 2. Read TODOIST_API_TOKEN from process.env (OpenClaw loads ~/.openclaw/.env into the gateway process)
 * 3. Fallback: check ~/.config/todoist/api_key if env missing (matches notion default-key pattern)
 * 4. Throw a precise error naming every path tried
 *
 * Do NOT silently fall back from agent-specific path to default if agentId was explicitly passed.
 */
export function getTodoistToken(agentId?: string): string {
  // Step 1: agent-specific token file
  if (agentId) {
    const agentKeyPath = join(homedir(), ".config", "todoist", `api_key_${agentId}`);
    try {
      const token = readFileSync(agentKeyPath, "utf8").trim();
      if (token) return token;
    } catch {
      // File not readable — continue to next step
    }
  }

  // Step 2: environment variable (OpenClaw loads ~/.openclaw/.env into process.env)
  const envToken = process.env.TODOIST_API_TOKEN;
  if (envToken) return envToken;

  // Step 3: fallback default key file
  const defaultKeyPath = join(homedir(), ".config", "todoist", "api_key");
  try {
    const token = readFileSync(defaultKeyPath, "utf8").trim();
    if (token) return token;
  } catch {
    // File not readable — continue to error
  }

  // Step 4: nothing worked — throw with full accounting
  const tried: string[] = [];
  if (agentId) {
    const agentKeyPath = join(homedir(), ".config", "todoist", `api_key_${agentId}`);
    tried.push(`  - ${agentKeyPath}: not readable or empty`);
  }
  tried.push(`  - process.env.TODOIST_API_TOKEN: not set or empty`);
  tried.push(`  - ${join(homedir(), ".config", "todoist", "api_key")}: not readable or empty`);

  throw new Error(
    `Could not resolve Todoist token for agent${agentId ? ` "${agentId}"` : ""}.\n` +
      `Tried:\n${tried.join("\n")}`
  );
}
