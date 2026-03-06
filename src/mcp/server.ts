#!/usr/bin/env bun
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { buildYoloAuthOptions, DEFAULT_BASE_URL, normalizeBaseUrl, shouldAttemptYoloAuth } from "./config.js";
import { buildPerplexityNavigatePayload, buildPerplexityNavigateResponse } from "./perplexity.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cliPath = path.join(repoRoot, "src", "cli.ts");
const packageJson = await Bun.file(path.join(repoRoot, "package.json")).json() as { version?: string };
const baseUrl = normalizeBaseUrl(process.env.UNBROWSE_URL || DEFAULT_BASE_URL);
const yoloEnabled = process.env.UNBROWSE_MCP_YOLO !== "0";
const defaultChromeProfile = process.env.UNBROWSE_YOLO_CHROME_PROFILE || "Default";
const defaultFirefoxProfile = process.env.UNBROWSE_YOLO_FIREFOX_PROFILE;
const noAutoStart = process.env.UNBROWSE_MCP_NO_AUTO_START === "1";

const server = new McpServer({
  name: "unbrowse",
  version: packageJson.version || "1.0.0",
});

function toolText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function ensureApiServer(): Promise<void> {
  try {
    const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (health.ok) return;
  } catch {
  }

  if (noAutoStart) {
    throw new Error(`Unbrowse server is not running at ${baseUrl} and auto-start is disabled.`);
  }

  spawn("bun", ["src/index.ts"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      SKILL_DIR: repoRoot,
      UNBROWSE_URL: baseUrl,
      UNBROWSE_NON_INTERACTIVE: process.env.UNBROWSE_NON_INTERACTIVE || "1",
      UNBROWSE_TOS_ACCEPTED: process.env.UNBROWSE_TOS_ACCEPTED || "1",
    },
  }).unref();

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) return;
    } catch {
    }
  }

  throw new Error(`Unbrowse server failed to start at ${baseUrl}.`);
}

async function callApi(method: string, requestPath: string, body?: unknown): Promise<unknown> {
  await ensureApiServer();
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!text) {
    return { ok: response.ok, status: response.status };
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as unknown;
  }

  return { ok: response.ok, status: response.status, body: text };
}

async function runCli(args: string[]): Promise<unknown> {
  const env = {
    ...process.env,
    SKILL_DIR: repoRoot,
    UNBROWSE_URL: baseUrl,
    UNBROWSE_NON_INTERACTIVE: process.env.UNBROWSE_NON_INTERACTIVE || "1",
    UNBROWSE_TOS_ACCEPTED: process.env.UNBROWSE_TOS_ACCEPTED || "1",
  };

  const cliArgs = [cliPath, ...args];
  if (noAutoStart) cliArgs.push("--no-auto-start");

  try {
    const { stdout, stderr } = await execFileAsync("bun", cliArgs, {
      cwd: repoRoot,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const trimmed = stdout.trim();
    if (!trimmed) {
      return { ok: true, stderr: stderr.trim() || undefined };
    }

    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = error as { stdout?: string; stderr?: string };
    const stdout = failure.stdout?.trim();
    if (stdout) {
      try {
        return JSON.parse(stdout) as unknown;
      } catch {
        return { error: message, stdout, stderr: failure.stderr?.trim() || undefined };
      }
    }
    return { error: message, stderr: failure.stderr?.trim() || undefined };
  }
}

async function maybeStealAuth(url: string, chromeProfile?: string, firefoxProfile?: string): Promise<unknown> {
  if (!shouldAttemptYoloAuth(yoloEnabled, url)) {
    return { skipped: true, reason: "yolo_disabled_or_invalid_url" };
  }

  const body = {
    url,
    ...buildYoloAuthOptions({
      chromeProfile: chromeProfile || defaultChromeProfile,
      firefoxProfile: firefoxProfile || defaultFirefoxProfile,
    }),
  };

  return callApi("POST", "/v1/auth/steal", body);
}

async function callJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    result: parsed,
  };
}

server.registerTool(
  "health",
  {
    description: "Check local Unbrowse server health.",
  },
  async () => {
    const result = await callApi("GET", "/health");
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "resolve_intent",
  {
    description: "Resolve a website intent through Unbrowse. In yolo mode this first steals browser auth from your real Chrome profile.",
    inputSchema: {
      intent: z.string().describe("What data or action you want from the site."),
      url: z.string().describe("Target page URL."),
      endpoint_id: z.string().optional().describe("Specific endpoint to force."),
      path: z.string().optional().describe("Optional result path drill-down like data.items[]."),
      extract: z.string().optional().describe("Comma-separated fields to extract."),
      limit: z.number().int().positive().optional().describe("Maximum rows to return."),
      force_capture: z.boolean().optional().describe("Force a new browser capture instead of caches."),
      raw: z.boolean().optional().describe("Return raw response data."),
      schema: z.boolean().optional().describe("Return only schema and extraction hints."),
      params_json: z.string().optional().describe("Extra params as JSON string."),
      yolo_auth: z.boolean().optional().describe("Preflight browser cookie extraction before resolving. Defaults to true when server yolo mode is enabled."),
      chrome_profile: z.string().optional().describe("Chrome profile name, defaults to Default."),
      firefox_profile: z.string().optional().describe("Firefox profile directory name override."),
    },
  },
  async ({ intent, url, endpoint_id, path: projectionPath, extract, limit, force_capture, raw, schema, params_json, yolo_auth, chrome_profile, firefox_profile }) => {
    const shouldSteal = yolo_auth ?? yoloEnabled;
    const auth = shouldSteal ? await maybeStealAuth(url, chrome_profile, firefox_profile) : { skipped: true, reason: "yolo_auth_disabled" };

    const args = ["resolve", "--intent", intent, "--url", url];
    if (endpoint_id) args.push("--endpoint-id", endpoint_id);
    if (projectionPath) args.push("--path", projectionPath);
    if (extract) args.push("--extract", extract);
    if (limit != null) args.push("--limit", String(limit));
    if (force_capture) args.push("--force-capture");
    if (raw) args.push("--raw");
    if (schema) args.push("--schema");
    if (params_json) args.push("--params", params_json);

    const result = await runCli(args);
    const response = { auth, result, yolo_mode: shouldSteal };
    return { content: [{ type: "text", text: toolText(response) }], structuredContent: response };
  }
);

server.registerTool(
  "execute_skill",
  {
    description: "Execute a previously discovered Unbrowse skill endpoint.",
    inputSchema: {
      skill: z.string().describe("Skill ID."),
      endpoint: z.string().optional().describe("Endpoint ID."),
      path: z.string().optional().describe("Optional result path drill-down."),
      extract: z.string().optional().describe("Comma-separated fields to extract."),
      limit: z.number().int().positive().optional().describe("Maximum rows to return."),
      raw: z.boolean().optional().describe("Return raw response data."),
      schema: z.boolean().optional().describe("Return only schema and extraction hints."),
      dry_run: z.boolean().optional().describe("Preview unsafe mutation behavior."),
      confirm_unsafe: z.boolean().optional().describe("Explicitly allow unsafe mutation execution."),
      params_json: z.string().optional().describe("Extra params as JSON string."),
    },
  },
  async ({ skill, endpoint, path: projectionPath, extract, limit, raw, schema, dry_run, confirm_unsafe, params_json }) => {
    const args = ["execute", "--skill", skill];
    if (endpoint) args.push("--endpoint", endpoint);
    if (projectionPath) args.push("--path", projectionPath);
    if (extract) args.push("--extract", extract);
    if (limit != null) args.push("--limit", String(limit));
    if (raw) args.push("--raw");
    if (schema) args.push("--schema");
    if (dry_run) args.push("--dry-run");
    if (confirm_unsafe) args.push("--confirm-unsafe");
    if (params_json) args.push("--params", params_json);

    const result = await runCli(args);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "perplexity_navigate_search",
  {
    description: "Run Perplexity's real navigate search endpoint directly, without live capture.",
    inputSchema: {
      query: z.string().describe("Search query."),
      lang: z.string().optional().describe("Language tag, defaults to en-US."),
      country: z.string().optional().describe("Country code, defaults to US."),
      cache_key: z.string().optional().describe("Optional cache key; random UUID when omitted."),
    },
  },
  async ({ query, lang, country, cache_key }) => {
    const payload = buildPerplexityNavigatePayload(query, {
      cacheKey: cache_key || crypto.randomUUID(),
      lang,
      country,
    });
    const result = await callJson("https://suggest.perplexity.ai/search/v3/navigate", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "origin": "https://www.perplexity.ai",
        "referer": "https://www.perplexity.ai/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });
    const response = buildPerplexityNavigateResponse("https://suggest.perplexity.ai/search/v3/navigate", payload, result);
    return { content: [{ type: "text", text: toolText(response) }], structuredContent: response };
  }
);

server.registerTool(
  "search_skills",
  {
    description: "Search the shared Unbrowse marketplace for skills matching an intent.",
    inputSchema: {
      intent: z.string().describe("What you want to do on the site."),
      domain: z.string().optional().describe("Optional domain filter like linkedin.com."),
      k: z.number().int().positive().optional().describe("Maximum results."),
    },
  },
  async ({ intent, domain, k }) => {
    const args = ["search", "--intent", intent];
    if (domain) args.push("--domain", domain);
    if (k != null) args.push("--k", String(k));
    const result = await runCli(args);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "list_skills",
  {
    description: "List marketplace skills visible to this Unbrowse instance.",
  },
  async () => {
    const result = await runCli(["skills"]);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "get_skill",
  {
    description: "Fetch details for a specific Unbrowse skill.",
    inputSchema: {
      id: z.string().describe("Skill ID."),
    },
  },
  async ({ id }) => {
    const result = await runCli(["skill", id]);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "steal_browser_auth",
  {
    description: "Yolo-mode auth helper. Read cookies from your real browser profile and store them in Unbrowse's vault.",
    inputSchema: {
      url: z.string().describe("Target site URL."),
      chrome_profile: z.string().optional().describe("Chrome profile name, defaults to Default."),
      firefox_profile: z.string().optional().describe("Firefox profile directory name override."),
    },
  },
  async ({ url, chrome_profile, firefox_profile }) => {
    const result = await maybeStealAuth(url, chrome_profile, firefox_profile);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "interactive_login",
  {
    description: "Open a visible browser for manual login and store the resulting cookies.",
    inputSchema: {
      url: z.string().describe("Target login URL."),
    },
  },
  async ({ url }) => {
    const result = await callApi("POST", "/v1/auth/login", { url });
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

server.registerTool(
  "submit_feedback",
  {
    description: "Submit endpoint feedback after a resolve or execute call.",
    inputSchema: {
      skill: z.string().describe("Skill ID."),
      endpoint: z.string().describe("Endpoint ID."),
      rating: z.number().int().min(1).max(5).describe("1=bad, 5=great."),
      outcome: z.string().optional().describe("Optional outcome label like success or wrong_endpoint."),
      diagnostics_json: z.string().optional().describe("Optional diagnostics object as JSON string."),
    },
  },
  async ({ skill, endpoint, rating, outcome, diagnostics_json }) => {
    const args = ["feedback", "--skill", skill, "--endpoint", endpoint, "--rating", String(rating)];
    if (outcome) args.push("--outcome", outcome);
    if (diagnostics_json) args.push("--diagnostics", diagnostics_json);
    const result = await runCli(args);
    return { content: [{ type: "text", text: toolText(result) }], structuredContent: result };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`Unbrowse MCP server ready on stdio (yolo=${yoloEnabled ? "on" : "off"}, baseUrl=${baseUrl})`);
