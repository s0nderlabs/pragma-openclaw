/**
 * Pragma OpenClaw Plugin — entry point.
 *
 * Spawns the pragma MCP server as a child process, proxies all tools
 * as OpenClaw agent tools, and registers delegation gateway methods
 * for the web-based delegation flow.
 */

import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { McpBridge } from "./bridge.js";
import { ensureSessionKey } from "./session-key.js";
import { setupDelegationMethods } from "./delegation.js";

// ---------------------------------------------------------------------------
// Minimal OpenClaw plugin types (inline to avoid requiring openclaw as a
// build dependency — these match OpenClaw v2026.2.9 plugin SDK).
// ---------------------------------------------------------------------------

interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

interface AgentToolResult {
  content: Array<{ type: string; text: string }>;
  details?: unknown;
}

interface AgentTool {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
  ) => Promise<AgentToolResult>;
}

type ToolFactory = (ctx: {
  config?: unknown;
  workspaceDir?: string;
  agentId?: string;
  sessionKey?: string;
  sandboxed?: boolean;
}) => AgentTool | AgentTool[] | null | undefined;

export type RespondFn = (
  ok: boolean,
  payload?: unknown,
  error?: { code?: string; message?: string },
) => void;

export type GatewayRequestHandler = (opts: {
  req: unknown;
  params: Record<string, unknown>;
  client: unknown;
  respond: RespondFn;
  context: unknown;
}) => void | Promise<void>;

export interface OpenClawPluginApi {
  id: string;
  name: string;
  pluginConfig?: Record<string, unknown>;
  logger: PluginLogger;
  registerTool: (
    tool: AgentTool | ToolFactory,
    opts?: { name?: string; names?: string[]; optional?: boolean },
  ) => void;
  registerGatewayMethod: (
    method: string,
    handler: GatewayRequestHandler,
  ) => void;
  registerService: (service: {
    id: string;
    start: (ctx?: unknown) => void | Promise<void>;
    stop?: (ctx?: unknown) => void | Promise<void>;
  }) => void;
}

// ---------------------------------------------------------------------------

interface PragmaPluginConfig {
  mode?: "byok" | "x402";
  configPath?: string;
  sessionKeyPath?: string;
}

function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return resolve(process.env.HOME || "/tmp", p.slice(2));
  }
  return p;
}

/** Ensure ~/.pragma/config.json exists with Monad mainnet chainId */
function ensurePragmaConfig(configPath: string): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (existsSync(configPath)) {
    // Verify existing config has correct chainId
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      if (raw.network?.chainId !== 143) {
        raw.network = { chainId: 143, name: "monad" };
        writeFileSync(configPath, JSON.stringify(raw, null, 2));
      }
    } catch {
      // Corrupted config — recreate
      writeFileSync(configPath, JSON.stringify({
        mode: "x402",
        network: { chainId: 143, name: "monad" },
      }, null, 2));
    }
    return;
  }

  // Create fresh config
  writeFileSync(configPath, JSON.stringify({
    mode: "x402",
    network: { chainId: 143, name: "monad" },
  }, null, 2));
}

const pragmaPlugin = {
  id: "pragma-openclaw",
  name: "pragma",
  description:
    "On-chain trading and market intelligence on Monad",
  configSchema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      mode: { type: "string", enum: ["byok", "x402"] },
      configPath: { type: "string" },
      sessionKeyPath: { type: "string" },
    },
  },

  async register(api: OpenClawPluginApi): Promise<void> {
    const cfg = (api.pluginConfig ?? {}) as PragmaPluginConfig;
    const configPath = expandPath(
      cfg.configPath ?? "~/.pragma/config.json",
    );
    const sessionKeyPath = expandPath(
      cfg.sessionKeyPath ?? "~/.pragma/session-key.json",
    );

    // Step 1: Ensure session key exists
    await ensureSessionKey(sessionKeyPath);

    // Step 1b: Ensure config exists with correct chainId (Monad mainnet = 143)
    ensurePragmaConfig(configPath);

    // Step 2: Create MCP bridge
    const bridge = new McpBridge({
      configPath,
      sessionKeyPath,
      signerType: "file",
      mode: cfg.mode,
    });

    // Step 3: Register as background service
    api.registerService({
      id: "pragma-mcp-bridge",
      start: () => bridge.connect(),
      stop: () => bridge.disconnect(),
    });

    // Step 4: Connect bridge and discover tools
    await bridge.connect();
    api.logger.info(
      `Pragma: connected, ${bridge.getTools().length} MCP tools discovered`,
    );

    // Step 5: Register MCP tools as agent tools (so the LLM can call them)
    // Register each tool individually — factory registration with optional:true
    // silently fails due to OpenClaw service lifecycle (disconnect clears cache
    // before factory is invoked).
    //
    // Blocklist: tools that require macOS (Touch ID / Secure Enclave / pragma-signer)
    // and have no headless fallback. Exposing them causes the bot to call them
    // and fail with "pragma-signer binary not found".
    const BLOCKED_TOOLS = new Set([
      "create_root_delegation",  // requires passkey signing (macOS Touch ID)
      // fund_session_key: UNBLOCKED — headless path uses root delegation (Groups 2/3)
      "nadfun_create",           // requires passkey signing (macOS Touch ID)
      // create_sub_agent: UNBLOCKED — signs with session key (secp256k1), not passkey
      // revoke_sub_agent: UNBLOCKED — plain EOA sweep + file ops, no signing
    ]);

    for (const mcpTool of bridge.getTools()) {
      if (BLOCKED_TOOLS.has(mcpTool.name)) {
        api.logger.info(`Pragma: skipping macOS-only tool: ${mcpTool.name}`);
        continue;
      }
      api.registerTool({
        name: `pragma_${mcpTool.name}`,
        label: `Pragma: ${mcpTool.name}`,
        description: mcpTool.description ?? mcpTool.name,
        parameters: mcpTool.inputSchema ?? {
          type: "object",
          properties: {},
        },
        async execute(
          _toolCallId: string,
          params: Record<string, unknown>,
        ): Promise<AgentToolResult> {
          const result = await bridge.callTool(mcpTool.name, params);
          return {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) },
            ],
            details: result,
          };
        },
      });
    }
    api.logger.info(
      `Pragma: ${bridge.getTools().length} MCP tools registered individually`,
    );

    // Step 6: Register delegation gateway methods (RPC)
    setupDelegationMethods(api, bridge, { sessionKeyPath, configPath });

    api.logger.info("Pragma: plugin registered successfully");
  },
};

export default pragmaPlugin;
