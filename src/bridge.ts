/**
 * MCP Bridge — spawns pragma MCP server as child process and proxies tool calls.
 *
 * Uses @modelcontextprotocol/sdk Client + StdioClientTransport to communicate
 * with the existing pragma MCP server bundle (server/index.js).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface BridgeConfig {
  configPath: string;
  sessionKeyPath: string;
  signerType: "file";
  mode?: "byok" | "x402";
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpBridge {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: McpTool[] = [];
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const serverPath = resolve(__dirname, "../server/index.js");

    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: {
        ...process.env,
        PRAGMA_CONFIG_PATH: this.config.configPath,
        PRAGMA_SIGNER_TYPE: this.config.signerType,
        PRAGMA_SESSION_KEY_PATH: this.config.sessionKeyPath,
        ...(this.config.mode && { PRAGMA_MODE: this.config.mode }),
      },
    });

    this.client = new Client(
      { name: "pragma-openclaw", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);

    // Cache tool list on connect
    const result = await this.client.listTools();
    this.tools = result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("McpBridge not connected. Call connect() first.");
    }

    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  getTools(): McpTool[] {
    return this.tools;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.tools = [];
  }
}
