import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import type { McpServerId, McpVerification } from "../types.js";
import { findMcpServer, type McpServerDef } from "../stack/mcp-catalog.js";

export interface ApplyMcpResult {
  written: boolean;
  serverCount: number;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  envFileWritten: boolean;
  hints: Array<{ server: string; hint: string }>;
  verifications: McpVerification[];
  resolvedEnv: Record<string, string>;
}

export async function applyMcp(opts: {
  targetPath: string;
  servers: McpServerId[];
  envVars: Record<string, string>;
}): Promise<ApplyMcpResult | null> {
  if (opts.servers.length === 0) return null;

  const mcpPath = path.join(opts.targetPath, ".mcp.json");
  const existing: { mcpServers: Record<string, unknown> } = existsSync(mcpPath)
    ? safeJson(await readFile(mcpPath, "utf8"))
    : { mcpServers: {} };
  if (!existing.mcpServers || typeof existing.mcpServers !== "object") {
    existing.mcpServers = {};
  }

  // Load any pre-existing .env to fill creds the user already set
  // (so re-runs don't force re-entering everything).
  const envFromDisk = await readEnvFile(opts.targetPath);
  const mergedEnvVars: Record<string, string> = {
    ...envFromDisk,
    ...opts.envVars,
  };

  const requiredEnvVars = new Set<string>();
  const missingEnvVars: string[] = [];
  const hints: Array<{ server: string; hint: string }> = [];
  const defs: McpServerDef[] = [];

  for (const id of opts.servers) {
    const def = findMcpServer(id);
    defs.push(def);
    existing.mcpServers[id] = def.config;
    if (def.requiresEnvVars) {
      for (const v of def.requiresEnvVars) {
        requiredEnvVars.add(v);
        if (!mergedEnvVars[v]) missingEnvVars.push(v);
      }
    }
    if (def.envHint) hints.push({ server: def.name, hint: def.envHint });
  }

  await writeFile(mcpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");

  const envFileWritten = await writeEnvFile(opts.targetPath, opts.envVars);

  const verifications = await verifyServers(defs, mergedEnvVars);

  return {
    written: true,
    serverCount: opts.servers.length,
    requiredEnvVars: [...requiredEnvVars],
    missingEnvVars: [...new Set(missingEnvVars)],
    envFileWritten,
    hints,
    verifications,
    resolvedEnv: mergedEnvVars,
  };
}

async function readEnvFile(targetPath: string): Promise<Record<string, string>> {
  const envPath = path.join(targetPath, ".env");
  if (!existsSync(envPath)) return {};
  const raw = await readFile(envPath, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

async function writeEnvFile(
  targetPath: string,
  envVars: Record<string, string>,
): Promise<boolean> {
  const entries = Object.entries(envVars).filter(([, v]) => v.length > 0);
  if (entries.length === 0) return false;

  const envPath = path.join(targetPath, ".env");
  const existing = existsSync(envPath) ? await readFile(envPath, "utf8") : "";

  const existingKeys = new Set(
    existing
      .split("\n")
      .map((l) => l.split("=")[0]?.trim())
      .filter(Boolean),
  );

  const toAppend = entries
    .filter(([k]) => !existingKeys.has(k))
    .map(([k, v]) => `${k}=${v}`);

  if (toAppend.length === 0) return false;

  const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(envPath, existing + sep + toAppend.join("\n") + "\n", "utf8");
  return true;
}

async function verifyServers(
  defs: McpServerDef[],
  envVars: Record<string, string>,
): Promise<McpVerification[]> {
  const results: McpVerification[] = [];
  for (const def of defs) {
    const missing = (def.requiresEnvVars ?? []).filter((v) => !envVars[v]);
    if (missing.length > 0) {
      results.push({
        server: def.id,
        status: "skipped",
        error: `Missing env vars: ${missing.join(", ")}`,
      });
      continue;
    }
    const result = await smokeTest(def, envVars);
    results.push({ server: def.id, ...result });
  }
  return results;
}

/**
 * Verify an MCP server end-to-end:
 *   1. JSON-RPC `initialize` handshake (id=1)
 *   2. If def.test is set: `tools/call` (id=2) and validate response
 *
 * Returns `ok` only if every requested step succeeds. The error string makes
 * the failing step explicit ("initialize: …" / "tools/call <name>: …").
 */
async function smokeTest(
  def: McpServerDef,
  envVars: Record<string, string>,
  timeoutMs = 25_000,
): Promise<{ status: "ok" | "failed"; error?: string; stage?: string }> {
  const expandedArgs = def.config.args.map((a) => expand(a, envVars));
  const childEnv = { ...process.env, ...envVars };

  return new Promise((resolve) => {
    let subprocess: ReturnType<typeof execa>;
    try {
      subprocess = execa(def.config.command, expandedArgs, {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        reject: false,
      });
    } catch (err) {
      resolve({
        status: "failed",
        error: (err as Error).message,
        stage: "spawn",
      });
      return;
    }

    let resolved = false;
    let stdoutBuf = "";
    let stderrBuf = "";
    let stage: "spawn" | "initialize" | "tools/call" = "spawn";

    const finish = (
      result: { status: "ok" | "failed"; error?: string },
    ) => {
      if (resolved) return;
      resolved = true;
      try {
        subprocess.kill("SIGTERM");
      } catch {
        // ignore
      }
      resolve({ ...result, stage });
    };

    const send = (msg: unknown) => {
      try {
        subprocess.stdin?.write(JSON.stringify(msg) + "\n");
      } catch (err) {
        finish({ status: "failed", error: (err as Error).message });
      }
    };

    const validateToolResponse = (msg: {
      result?: { content?: unknown; isError?: boolean };
    }): { ok: true } | { ok: false; reason: string } => {
      if (!def.test) return { ok: true };
      const r = msg.result;
      if (!r) return { ok: false, reason: "no result envelope" };
      if (r.isError) return { ok: false, reason: "tool reported isError" };
      if (def.test.expectField && r[def.test.expectField as "content"] === undefined) {
        return { ok: false, reason: `missing field: ${def.test.expectField}` };
      }
      if (def.test.expectPattern && Array.isArray(r.content)) {
        const re = new RegExp(def.test.expectPattern);
        const ok = r.content.some(
          (c: { text?: string }) => typeof c.text === "string" && re.test(c.text),
        );
        if (!ok) {
          return { ok: false, reason: `no content matched /${def.test.expectPattern}/` };
        }
      }
      return { ok: true };
    };

    subprocess.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      let nl;
      while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: number; result?: { content?: unknown; isError?: boolean }; error?: { message?: string } };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }

        if (msg.id === 1) {
          if (msg.error) {
            finish({
              status: "failed",
              error: `initialize: ${msg.error.message ?? "error"}`,
            });
            return;
          }
          if (!msg.result) continue;
          // initialize OK; either we're done, or we proceed to tools/call.
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          if (!def.test) {
            finish({ status: "ok" });
            return;
          }
          stage = "tools/call";
          send({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: def.test.tool, arguments: def.test.args ?? {} },
          });
          continue;
        }

        if (msg.id === 2) {
          if (msg.error) {
            finish({
              status: "failed",
              error: `tools/call ${def.test?.tool}: ${msg.error.message ?? "error"}`,
            });
            return;
          }
          const verdict = validateToolResponse(msg);
          if (verdict.ok) {
            finish({ status: "ok" });
          } else {
            finish({
              status: "failed",
              error: `tools/call ${def.test?.tool}: ${verdict.reason}`,
            });
          }
          return;
        }
      }
    });

    subprocess.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    subprocess.on("error", (err: Error) => {
      finish({ status: "failed", error: err.message });
    });

    subprocess.on("exit", (code) => {
      if (resolved) return;
      const trimmed = stderrBuf.trim();
      const tail = trimmed ? trimmed.split("\n").slice(-3).join(" ") : "";
      finish({
        status: "failed",
        error: `${stage}: ${tail || `exited (code ${code})`}`,
      });
    });

    const timer = setTimeout(() => {
      finish({
        status: "failed",
        error: `${stage}: timeout after ${Math.round(timeoutMs / 1000)}s`,
      });
    }, timeoutMs);
    timer.unref();

    stage = "initialize";
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ccup", version: "0.1.0" },
      },
    });
  });
}

function expand(s: string, envVars: Record<string, string>): string {
  return s.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => envVars[name] ?? "");
}

function safeJson(raw: string): { mcpServers: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { mcpServers: {}, ...parsed };
    }
  } catch {
    // fall through
  }
  return { mcpServers: {} };
}
