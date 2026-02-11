/**
 * Delegation Flow — 4 OpenClaw gateway methods + agent tools for web-based delegation.
 *
 * Instead of Touch ID, OpenClaw users approve delegations via pr4gma.xyz.
 * The flow is:
 *   1. setup_session   — Register session key with the API
 *   2. request_delegation — Create a delegation request, get approval URL
 *   3. poll_delegation  — Check if user approved
 *   4. retrieve_delegation — Get signed delegation, store locally
 *
 * Each method is registered as BOTH:
 *   - Gateway RPC method (HTTP endpoint)
 *   - Agent tool (LLM-callable during /setup flow)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { McpBridge } from "./bridge.js";
import { ensureSessionKey, loadSessionKey } from "./session-key.js";
import type { OpenClawPluginApi } from "./index.js";
import { encodeAbiParameters, getAddress, parseEther, toHex, concat, pad, type Address, type Hex } from "viem";

const API_BASE = "https://api.pr4gma.xyz";

// ============================================================================
// On-chain constants (Monad mainnet, chainId: 143)
// ============================================================================

const CHAIN_ID = 143;
const DELEGATION_MANAGER = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3" as Address;

// Enforcer contracts
const TIMESTAMP_ENFORCER = "0x1046bb45C8d673d4ea75321280DB34899413c069" as Address;
const LIMITED_CALLS_ENFORCER = "0x04658B29F6b82ed55274221a06Fc97D318E25416" as Address;
const VALUE_LTE_ENFORCER = "0x92Bf12322527cAA612fd31a0e810472BBB106A8F" as Address;
const LOGICAL_OR_WRAPPER_ENFORCER = "0xE1302607a3251AF54c3a6e69318d6aa07F5eB46c" as Address;
const ALLOWED_METHODS_ENFORCER = "0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5" as Address;
const ALLOWED_TARGETS_ENFORCER = "0x7F20f61b1f09b08D970938F6fa563634d65c4EeB" as Address;
const ALLOWED_CALLDATA_ENFORCER = "0xc2b0d624c1c4319760C96503BA27C347F3260f55" as Address;
const NATIVE_TOKEN_TRANSFER_AMOUNT_ENFORCER = "0xF71af580b9c3078fbc2BBF16FbB8EEd82b330320" as Address;

// Protocol contracts
const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as Address;
const LEVERUP_DIAMOND = "0xea1b8E4aB7f14F7dCA68c5B214303B13078FC5ec" as Address;
const DEX_AGGREGATOR = "0x0000000000001fF3684f28c67538d4D072C22734" as Address;
const NADFUN_ROUTER = "0x6F6B8F1a20703309951a5127c45B49b1CD981A22" as Address;
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as Address;
const LVUSD = "0xFD44B35139Ae53FFF7d8F2A9869c503D987f00d1" as Address;
const LVMON = "0x91b81bfbe3A747230F0529Aa28d8b2Bc898E6D56" as Address;

// Function selectors per protocol
const LEVERUP_SELECTORS: Hex[] = [
  "0xca004414", "0x5177fd3b", "0xe1379570", "0x2f745df6",
  "0xf37afc20", "0x4584eff6", "0x54688625",
];
const NADFUN_SELECTORS: Hex[] = ["0x6df9e92b", "0x5de3085d"];
const WMON_SELECTORS: Hex[] = ["0xd0e30db0", "0x2e1a7d4d"];
const DEX_SELECTORS: Hex[] = ["0x1fff991f", "0x2213bc0b"];
const ERC20_TRANSFER_SELECTOR: Hex = "0xa9059cbb";
const APPROVE_SELECTOR: Hex = "0x095ea7b3";

const ROOT_AUTHORITY = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as Hex;
const ZERO_SALT = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

type ProtocolId = "dex" | "leverup" | "nadfun" | "wmon";

const PROTOCOL_CONFIG: Record<ProtocolId, { targets: Address[]; selectors: Hex[] }> = {
  leverup: { targets: [LEVERUP_DIAMOND], selectors: LEVERUP_SELECTORS },
  nadfun: { targets: [NADFUN_ROUTER], selectors: NADFUN_SELECTORS },
  dex: { targets: [DEX_AGGREGATOR], selectors: DEX_SELECTORS },
  wmon: { targets: [WMON], selectors: WMON_SELECTORS },
};

// ============================================================================
// Delegation building
// ============================================================================

function packAddresses(addresses: Address[]): Hex {
  return `0x${addresses.map((a) => a.slice(2).toLowerCase()).join("")}` as Hex;
}

function packSelectors(selectors: Hex[]): Hex {
  return `0x${selectors.map((s) => s.slice(2)).join("")}` as Hex;
}

function resolveProtocols(raw: unknown): ProtocolId[] {
  const ALL: ProtocolId[] = ["dex", "leverup", "nadfun", "wmon"];
  if (!raw || raw === "all") return ALL;
  if (Array.isArray(raw)) {
    const valid = raw.filter((p): p is ProtocolId => ALL.includes(p as ProtocolId));
    return valid.length > 0 ? valid : ALL;
  }
  return ALL;
}

/**
 * Build ERC20 transfer group for a single recipient.
 * Caveats: AllowedMethods(transfer) + AllowedCalldata(offset=4, recipient)
 */
function buildErc20TransferGroup(recipient: Address): {
  caveats: Array<{ enforcer: Address; terms: Hex; args: Hex }>;
} {
  // AllowedCalldata terms: concat([startIndex as uint256, value])
  // startIndex = 4 (after 4-byte selector), value = padded recipient address
  const calldataTerms = concat([
    toHex(4, { size: 32 }),
    pad(recipient as Hex, { size: 32 }),
  ]) as Hex;

  return {
    caveats: [
      {
        enforcer: ALLOWED_METHODS_ENFORCER,
        terms: packSelectors([ERC20_TRANSFER_SELECTOR]),
        args: "0x" as Hex,
      },
      {
        enforcer: ALLOWED_CALLDATA_ENFORCER,
        terms: calldataTerms,
        args: "0x" as Hex,
      },
    ],
  };
}

/**
 * Build native MON transfer group for a single recipient.
 * Caveats: AllowedTargets(recipient) + NativeTokenTransferAmount(maxAmount)
 */
function buildNativeTransferGroup(recipient: Address, maxAmount: bigint): {
  caveats: Array<{ enforcer: Address; terms: Hex; args: Hex }>;
} {
  return {
    caveats: [
      {
        enforcer: ALLOWED_TARGETS_ENFORCER,
        terms: packAddresses([recipient]),
        args: "0x" as Hex,
      },
      {
        enforcer: NATIVE_TOKEN_TRANSFER_AMOUNT_ENFORCER,
        terms: toHex(maxAmount, { size: 32 }),
        args: "0x" as Hex,
      },
    ],
  };
}

function buildDelegationData(params: {
  sa: string;
  sessionKey: string;
  protocols: ProtocolId[];
  expiryDays: number;
  maxCalls: number;
  maxValuePerTxMon: number;
  enableTransfers?: boolean;
  transferRecipients?: Address[];
}): { unsignedDelegation: string; typedData: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + params.expiryDays * 86400;

  // Collect targets and selectors from selected protocols
  const targets = new Set<Address>([WMON, USDC, LVUSD, LVMON]);
  const selectors = new Set<Hex>([ERC20_TRANSFER_SELECTOR]);

  for (const protocol of params.protocols) {
    const cfg = PROTOCOL_CONFIG[protocol];
    if (cfg) {
      cfg.targets.forEach((t) => targets.add(t));
      cfg.selectors.forEach((s) => selectors.add(s));
    }
  }

  // Group 1: approve() to any target
  const approveGroup = {
    caveats: [{
      enforcer: ALLOWED_METHODS_ENFORCER,
      terms: packSelectors([APPROVE_SELECTOR]),
      args: "0x" as Hex,
    }],
  };

  // Group 2: trading targets + methods
  const tradingGroup = {
    caveats: [
      {
        enforcer: ALLOWED_TARGETS_ENFORCER,
        terms: packAddresses([...targets]),
        args: "0x" as Hex,
      },
      {
        enforcer: ALLOWED_METHODS_ENFORCER,
        terms: packSelectors([...selectors]),
        args: "0x" as Hex,
      },
    ],
  };

  // Build group array: always approve + trading, optionally transfer groups
  const allGroups = [approveGroup, tradingGroup];

  const enableTransfers = params.enableTransfers ?? true;
  const transferRecipients = params.transferRecipients ?? [getAddress(params.sessionKey) as Address];

  if (enableTransfers && transferRecipients.length > 0) {
    const maxNative = parseEther(String(params.maxValuePerTxMon));
    for (const recipient of transferRecipients) {
      allGroups.push(buildErc20TransferGroup(recipient));
      allGroups.push(buildNativeTransferGroup(recipient, maxNative));
    }
  }

  const logicalOrTerms = encodeAbiParameters(
    [{
      type: "tuple[]",
      components: [{
        name: "caveats",
        type: "tuple[]",
        components: [
          { name: "enforcer", type: "address" },
          { name: "terms", type: "bytes" },
          { name: "args", type: "bytes" },
        ],
      }],
    }],
    [allGroups.map((g) => ({ caveats: g.caveats }))],
  );

  // Packed encoding: 16 bytes afterThreshold + 16 bytes beforeThreshold = 32 bytes
  // Must match DTK's createTimestampTerms format (NOT ABI-encoded uint128 pairs)
  const timestampTerms = concat([
    toHex(0n, { size: 16 }),
    toHex(BigInt(expiresAt), { size: 16 }),
  ]) as Hex;

  const limitedCallsTerms = encodeAbiParameters(
    [{ type: "uint256" }],
    [BigInt(params.maxCalls)],
  );

  const valueLteTerms = encodeAbiParameters(
    [{ type: "uint256" }],
    [parseEther(String(params.maxValuePerTxMon))],
  );

  const caveats = [
    { enforcer: LOGICAL_OR_WRAPPER_ENFORCER, terms: logicalOrTerms, args: "0x" as Hex },
    { enforcer: TIMESTAMP_ENFORCER, terms: timestampTerms, args: "0x" as Hex },
    { enforcer: LIMITED_CALLS_ENFORCER, terms: limitedCallsTerms, args: "0x" as Hex },
    { enforcer: VALUE_LTE_ENFORCER, terms: valueLteTerms, args: "0x" as Hex },
  ];

  const unsignedDelegation = {
    delegate: params.sessionKey,
    delegator: params.sa,
    authority: ROOT_AUTHORITY,
    salt: ZERO_SALT,
    caveats: caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms, args: c.args })),
  };

  const typedData = {
    domain: {
      name: "DelegationManager",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: DELEGATION_MANAGER,
    },
    types: {
      Delegation: [
        { name: "delegate", type: "address" },
        { name: "delegator", type: "address" },
        { name: "authority", type: "bytes32" },
        { name: "caveats", type: "Caveat[]" },
        { name: "salt", type: "uint256" },
      ],
      Caveat: [
        { name: "enforcer", type: "address" },
        { name: "terms", type: "bytes" },
      ],
    },
    primaryType: "Delegation" as const,
    message: {
      delegate: params.sessionKey,
      delegator: params.sa,
      authority: ROOT_AUTHORITY,
      caveats: caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: "0",
    },
  };

  return {
    unsignedDelegation: JSON.stringify(unsignedDelegation),
    typedData: JSON.stringify(typedData),
  };
}

interface DelegationConfig {
  sessionKeyPath: string;
  configPath: string;
}

// ============================================================================
// Shared handler logic (used by both gateway methods and agent tools)
// ============================================================================

interface HandlerResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function handleSetupSession(
  params: Record<string, unknown>,
  config: DelegationConfig,
): Promise<HandlerResult> {
  const keyData = await ensureSessionKey(config.sessionKeyPath);
  const sa = params.sa as string | undefined;

  if (!sa) {
    return {
      ok: true,
      data: {
        address: keyData.address,
        registered: false,
        message:
          "Session key ready. Provide 'sa' (Smart Account address) to register with the API.",
      },
    };
  }

  const res = await fetch(`${API_BASE}/session-key/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sa,
      sessionKey: keyData.address,
      label: (params.label as string) ?? "openclaw-agent",
      agentType: (params.agentType as string) ?? "pragma",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: "API_ERROR",
        message: String(data.error ?? `API returned ${res.status}`),
      },
    };
  }

  // Persist SA address to local config so MCP tools (get_all_balances, etc.) work
  try {
    const raw = existsSync(config.configPath)
      ? JSON.parse(readFileSync(config.configPath, "utf-8"))
      : { mode: "x402", network: { chainId: 143, name: "monad" } };
    raw.wallet = {
      smartAccountAddress: sa,
      sessionKeyAddress: keyData.address,
      keyId: "file-based",
    };
    // Ensure correct chainId
    if (!raw.network || raw.network.chainId !== 143) {
      raw.network = { chainId: 143, name: "monad" };
    }
    writeFileSync(config.configPath, JSON.stringify(raw, null, 2));
  } catch {
    // Non-fatal — tools will still work if config is written later
  }

  return { ok: true, data: { address: keyData.address, registered: true, sa } };
}

async function handleRequestDelegation(
  params: Record<string, unknown>,
  config: DelegationConfig,
): Promise<HandlerResult> {
  const keyData = loadSessionKey(config.sessionKeyPath);
  const sa = params.sa as string | undefined;

  if (!sa) {
    return {
      ok: false,
      error: { code: "MISSING_PARAM", message: "sa (Smart Account address) is required" },
    };
  }

  const durationDays = (params.expiryDays as number) ?? 7;
  const durationSeconds = durationDays * 86400;
  const maxCalls = (params.maxCalls as number) ?? 100;
  const maxValuePerTxMon = (params.maxValuePerTxMon as number) ?? 1;
  const protocols = resolveProtocols(params.protocols);

  // Transfer group config
  const enableTransfers = (params.enableTransfers as boolean | undefined) ?? true;
  const transferRecipients = (params.transferRecipients as string[] | undefined)
    ?.map((a) => getAddress(a) as Address) ?? undefined; // undefined → defaults to [sessionKey] in builder

  // Build on-chain delegation struct + EIP-712 typed data
  const { unsignedDelegation, typedData } = buildDelegationData({
    sa,
    sessionKey: keyData.address,
    protocols,
    expiryDays: durationDays,
    maxCalls,
    maxValuePerTxMon,
    enableTransfers,
    transferRecipients,
  });

  const res = await fetch(`${API_BASE}/delegation/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sa,
      sessionKey: keyData.address,
      agentId: (params.agentId as string) ?? undefined,
      budget: (params.budgetUsd as number) ?? 100,
      gasBudget: String((params.budgetMon as number) ?? 1),
      tokens: params.allowedTokens === "all" ? undefined : params.allowedTokens,
      duration: durationSeconds,
      protocols: protocols,
      description: (params.description as string) ?? undefined,
      unsignedDelegation,
      typedData,
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: "API_ERROR",
        message: String(data.error ?? `API returned ${res.status}`),
      },
    };
  }

  return {
    ok: true,
    data: {
      requestId: data.requestId,
      approvalUrl: data.approvalUrl,
      expiresIn: data.expiresIn,
      sessionKeyAddress: keyData.address,
      protocols,
    },
  };
}

async function handlePollDelegation(
  params: Record<string, unknown>,
): Promise<HandlerResult> {
  const requestId = params.requestId as string;
  if (!requestId) {
    return {
      ok: false,
      error: { code: "MISSING_PARAM", message: "requestId is required" },
    };
  }

  const res = await fetch(`${API_BASE}/delegation/request/${requestId}/status`);
  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: "API_ERROR",
        message: String(data.error ?? `API returned ${res.status}`),
      },
    };
  }

  return {
    ok: true,
    data: {
      requestId: data.requestId,
      status: data.status,
      resolvedAt: data.resolvedAt,
    },
  };
}

async function handleRetrieveDelegation(
  params: Record<string, unknown>,
  config: DelegationConfig,
): Promise<HandlerResult> {
  const requestId = params.requestId as string;
  if (!requestId) {
    return {
      ok: false,
      error: { code: "MISSING_PARAM", message: "requestId is required" },
    };
  }

  const res = await fetch(`${API_BASE}/delegation/request/${requestId}`);
  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: "API_ERROR",
        message: String(data.error ?? `API returned ${res.status}`),
      },
    };
  }

  const request = data.request as Record<string, unknown>;
  if (request.status !== "approved") {
    return {
      ok: false,
      error: {
        code: "NOT_APPROVED",
        message: `Delegation not yet approved (status: ${request.status})`,
      },
    };
  }

  // Build signed delegation from unsignedDelegation + signature
  const signature = request.signature as string | undefined;
  if (!signature) {
    return {
      ok: false,
      error: {
        code: "NO_SIGNATURE",
        message: "Delegation approved but no signature found in API response",
      },
    };
  }

  let unsignedDelegation: Record<string, unknown> = {};
  try {
    unsignedDelegation = JSON.parse(request.unsignedDelegation as string);
  } catch {
    return {
      ok: false,
      error: {
        code: "PARSE_ERROR",
        message: "Failed to parse unsignedDelegation from API response",
      },
    };
  }

  const signedDelegation = { ...unsignedDelegation, signature };

  // Store signed delegation locally
  const delegationDir = resolve(
    dirname(config.sessionKeyPath),
    "delegations",
    "root",
  );
  if (!existsSync(delegationDir)) {
    mkdirSync(delegationDir, { recursive: true });
  }

  const delegationFile = resolve(delegationDir, "delegation.json");
  const delegationData = {
    requestId,
    signedDelegation,
    delegator: request.sa,
    delegate: request.sessionKey,
    duration: request.duration,
    protocols: request.protocols,
    retrievedAt: Date.now(),
  };

  writeFileSync(delegationFile, JSON.stringify(delegationData, null, 2), {
    mode: 0o600,
  });

  return {
    ok: true,
    data: {
      requestId,
      storagePath: delegationFile,
      delegator: request.sa,
      delegate: request.sessionKey,
    },
  };
}

// ============================================================================
// Gateway method + agent tool registration
// ============================================================================

/** Convert handler result to gateway respond() call */
function gatewayRespond(
  result: HandlerResult,
  respond: (ok: boolean, payload?: unknown, error?: { code?: string; message?: string }) => void,
): void {
  if (result.ok) {
    respond(true, result.data);
  } else {
    respond(false, undefined, result.error);
  }
}

/** Convert handler result to agent tool result */
function toolResult(result: HandlerResult): {
  content: Array<{ type: string; text: string }>;
  details?: unknown;
} {
  if (result.ok) {
    return {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      details: result.data,
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { error: result.error?.code, message: result.error?.message },
          null,
          2,
        ),
      },
    ],
  };
}

/**
 * Register delegation gateway methods AND agent tools on the OpenClaw API.
 */
export function setupDelegationMethods(
  api: OpenClawPluginApi,
  _bridge: McpBridge,
  config: DelegationConfig,
): void {
  // --- 1. setup_session ---
  api.registerGatewayMethod("pragma.setup_session", async ({ params, respond }) => {
    try {
      gatewayRespond(await handleSetupSession(params, config), respond);
    } catch (err) {
      respond(false, undefined, {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  api.registerTool({
    name: "pragma_setup_session",
    label: "Pragma: Setup Session",
    description:
      "Register session key with the Pragma API. Pass 'sa' (Smart Account address) to complete registration. Without 'sa', returns the session key address.",
    parameters: {
      type: "object",
      properties: {
        sa: { type: "string", description: "User's Smart Account address (0x...)" },
        label: { type: "string", description: "Label for this session key" },
        agentType: { type: "string", description: "Agent type identifier" },
      },
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        return toolResult(await handleSetupSession(params, config));
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  });

  // --- 2. request_delegation ---
  api.registerGatewayMethod("pragma.request_delegation", async ({ params, respond }) => {
    try {
      gatewayRespond(await handleRequestDelegation(params, config), respond);
    } catch (err) {
      respond(false, undefined, {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  api.registerTool({
    name: "pragma_request_delegation",
    label: "Pragma: Request Delegation",
    description:
      "Create a delegation request and get an approval URL. The user opens the URL in their browser to approve trading permissions.",
    parameters: {
      type: "object",
      required: ["sa"],
      properties: {
        sa: { type: "string", description: "User's Smart Account address (0x...)" },
        protocols: {
          type: "array",
          items: { type: "string", enum: ["dex", "leverup", "nadfun", "wmon"] },
          description: "Allowed protocols. Options: dex, leverup, nadfun, wmon. Default: all.",
        },
        expiryDays: { type: "number", description: "Delegation duration in days (default: 7)" },
        maxCalls: { type: "number", description: "Max on-chain calls — trades + approvals (default: 100)" },
        maxValuePerTxMon: { type: "number", description: "Max native MON value per transaction (default: 1)" },
        budgetUsd: { type: "number", description: "Off-chain budget in USD (default: 100)" },
        budgetMon: { type: "number", description: "Gas budget in MON (default: 1)" },
        allowedTokens: { description: "Allowed tokens array or 'all'" },
        agentId: { type: "string", description: "Agent identifier" },
        description: { type: "string", description: "Human-readable delegation description" },
        enableTransfers: { type: "boolean", description: "Enable ERC20 and native transfer groups for session key self-funding (default: true)" },
        transferRecipients: { type: "array", items: { type: "string" }, description: "Whitelisted transfer recipients (0x addresses). Default: [session key address]" },
      },
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        return toolResult(await handleRequestDelegation(params, config));
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  });

  // --- 3. poll_delegation ---
  api.registerGatewayMethod("pragma.poll_delegation", async ({ params, respond }) => {
    try {
      gatewayRespond(await handlePollDelegation(params), respond);
    } catch (err) {
      respond(false, undefined, {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  api.registerTool({
    name: "pragma_poll_delegation",
    label: "Pragma: Poll Delegation",
    description:
      "Check if the user has approved a delegation request. Returns status: pending, approved, rejected, or expired.",
    parameters: {
      type: "object",
      required: ["requestId"],
      properties: {
        requestId: { type: "string", description: "The delegation request ID from request_delegation" },
      },
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        return toolResult(await handlePollDelegation(params));
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  });

  // --- 4. retrieve_delegation ---
  api.registerGatewayMethod("pragma.retrieve_delegation", async ({ params, respond }) => {
    try {
      gatewayRespond(await handleRetrieveDelegation(params, config), respond);
    } catch (err) {
      respond(false, undefined, {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  api.registerTool({
    name: "pragma_retrieve_delegation",
    label: "Pragma: Retrieve Delegation",
    description:
      "Retrieve the signed delegation after user approval and store it locally. Must be called after poll_delegation returns 'approved'.",
    parameters: {
      type: "object",
      required: ["requestId"],
      properties: {
        requestId: { type: "string", description: "The delegation request ID" },
      },
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        return toolResult(await handleRetrieveDelegation(params, config));
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    },
  });
}
