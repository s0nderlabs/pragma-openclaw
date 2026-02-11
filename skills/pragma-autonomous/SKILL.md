---
name: pragma-autonomous
description: Manages autonomous trading with sub-agents. Use when user mentions autonomous, background trading, AFK trading, monitoring while away, delegate trading, hands-free trading, while I sleep, overnight, keep running, monitor and execute, condition trigger, or run until.
tools:
  - pragma_has_wallet
  - pragma_get_all_balances
  - pragma_get_balance
  - pragma_get_account_info
  - pragma_check_session_key_balance
  - pragma_fund_session_key
  - pragma_setup_session
  - pragma_request_delegation
  - pragma_poll_delegation
  - pragma_retrieve_delegation
  - pragma_create_sub_agent
  - pragma_get_sub_agent_state
  - pragma_fund_sub_agent
  - pragma_list_sub_agents
  - pragma_revoke_sub_agent
  - pragma_report_agent_status
  - pragma_get_agent_log
  - pragma_write_agent_memo
  - pragma_market_get_chart
  - pragma_market_get_critical_news
  - pragma_market_get_economic_events
  - pragma_leverup_list_positions
  - pragma_leverup_list_pairs
  - pragma_nadfun_positions
requires:
  - pragma
metadata:
  openclaw:
    requires: ["pragma"]
---

# Pragma Autonomous — Sub-Agent Trading

> Manages autonomous trading sessions using sub-agents for concurrent, isolated execution.

## Overview

Autonomous mode combines two systems:
- **OpenClaw `sessions_spawn`** — background execution lifecycle, timeout, announce results
- **Pragma sub-agents** — wallet isolation, scoped delegation chain, on-chain budget enforcement, trade journal

Each sub-agent gets its own wallet (no nonce conflicts), scoped permissions (kairos can only trade perps, thymos only memecoins), and budget tracking. The main agent monitors sub-agents via heartbeat and reports to the user.

---

## Phase 1: Setup Check

```
1. pragma_has_wallet → Wallet configured?
   → No: Guide user through pragma-setup skill first
   → Yes: Continue

2. pragma_get_all_balances → Portfolio baseline
3. pragma_check_session_key_balance → Gas available?
   → < 0.1 MON: Ask user to send gas to session key address
```

## Phase 2: Delegation

If no delegation exists, use the **pragma-delegation** skill:
1. Ask user about trading scope
2. Submit delegation request with on-chain caveats
3. Guide user to approval URL
4. Poll and retrieve signed delegation

If delegation already exists and is valid, skip this phase.

## Phase 3: Auto-Detect Agent Type

Based on the user's request, auto-select which sub-agent(s) to spawn:

| User intent | Agent | Why |
|-------------|-------|-----|
| "monitor BTC, open long when funding flips" | kairos | Perps strategy |
| "watch ETH/BTC ratio for squeeze" | kairos | Leveraged trading |
| "snipe new tokens on nad.fun" | thymos | Memecoin strategy |
| "buy momentum tokens, sell at 2x" | thymos | Bonding curve trading |
| "trade perps AND scan memecoins" | kairos + thymos | Both detected |
| "monitor market and execute when ready" | pragma | General/conditional |
| "swap USDC to MON when price drops 5%" | pragma | Spot/conditional |

The user never needs to name agents — they describe what they want.

## Phase 4: Create Sub-Agents

For each agent type detected:

```
pragma_create_sub_agent({
  agentType: "kairos" | "thymos" | "pragma",
  budgetMon: <from delegation scope>,
  budgetUsd: <if applicable>,
  expiryDays: <match delegation>,
  maxCalls: <calculated from delegation>,
  fundAmount: 0.5
})
→ Returns: { subAgentId, walletAddress, agentType }
```

If funding was not included in creation, fund separately:
```
pragma_fund_sub_agent({ subAgentId, amount: "0.5" })
```

## Phase 5: Spawn Background Sessions

For each created sub-agent, spawn a background session:

```
sessions_spawn({
  task: "You are a [agentType] sub-agent.
    Your pragma sub-agent ID is [subAgentId].
    CRITICAL: Pass agentId=\"[subAgentId]\" to EVERY pragma_ trading tool call.

    On start: call pragma_report_agent_status({ agentId: \"[subAgentId]\", status: \"running\" })
    During execution: call pragma_write_agent_memo({ agentId: \"[subAgentId]\", text: \"...\", tag: \"...\" }) to persist reasoning
    On finish: call pragma_report_agent_status({ agentId: \"[subAgentId]\", status: \"completed\" or \"failed\", reason: \"...\" })

    Mission: [user's strategy description]",
  label: "[agentType]-[short-id]",
  runTimeoutSeconds: 86400
})
```

Tell the user which sub-agents were spawned and what they're doing.

## Phase 6: Heartbeat Monitoring

After spawning, update `HEARTBEAT.md` in the workspace:

```md
# Heartbeat checklist
- Check pragma sub-agents: call pragma_list_sub_agents, then pragma_get_sub_agent_state for each active one
- Report budget remaining, trades executed, gas balance, and errors to user
- If any sub-agent gas < 0.2 MON: alert user immediately
- If any sub-agent status = completed or failed: announce results and offer cleanup
- If delegation expiring < 24h: warn user and offer renewal
- If all sub-agents completed: remove this checklist from HEARTBEAT.md
```

The main agent wakes up on heartbeat every 30 minutes and:
1. Calls `pragma_list_sub_agents` → which are running?
2. Calls `pragma_get_sub_agent_state({ subAgentId })` for each active one → budget, gas, trades, errors
3. Calls `pragma_get_agent_log({ agentId, limit: 5 })` → recent decisions
4. Reports a concise summary to the user
5. Alerts on low gas, budget warnings, completions, errors

## Phase 7: Cleanup

When sub-agents complete or user requests stop:

```
pragma_revoke_sub_agent({ subAgentId, sweepBalance: true })
```

After all sub-agents are cleaned up, remove the monitoring checklist from `HEARTBEAT.md`.

---

## Sub-Agent Behavior (instructions passed via spawn task)

The spawned sub-agent receives its instructions via the `sessions_spawn` task. Key rules:

1. **Always pass agentId** to every `pragma_` trading tool call — this routes through the sub-agent's delegation chain
2. **Report status** via `pragma_report_agent_status` on start, completion, failure, or pause
3. **Write memos** via `pragma_write_agent_memo` to persist reasoning (survives context compaction):
   - Tag `baseline`: Initial market analysis
   - Tag `watchlist`: Pairs and trigger levels being monitored
   - Tag `trade_plan`: Kill switch + bear case + trade params before entering
   - Tag `position_health`: Monitoring snapshots
   - Tag `post_trade`: Session summary and PnL
4. **Budget awareness**: The delegation chain enforces limits on-chain. If a tool returns budget/calls exceeded, stop and report.
5. **Gas awareness**: If a tool fails with gas errors, call `pragma_report_agent_status({ status: "paused", reason: "Low gas" })` — the main agent will see this on next heartbeat.

---

## Session Key Self-Funding

Delegations include transfer groups, allowing gas management:

- **Session key gas:** `pragma_fund_session_key(operationType: "swap", estimatedOperations: 5)` — uses delegation Group 3
- **Sub-agent gas:** `pragma_fund_sub_agent({ subAgentId, amount: "0.5" })` — plain EOA transfer from session key

**Constraints:**
- Self-funding requires > 0.02 MON gas to submit the transaction
- If gas is zero, tell the user: "Session key is out of gas. Please send at least 0.5 MON to: [address]"
- No UserOp on this platform

---

## Error Recovery

| Error | Recovery |
|-------|----------|
| Delegation expired | Notify user, use pragma-delegation skill to renew, then re-create sub-agents |
| Sub-agent gas low | Main agent funds it via `pragma_fund_sub_agent` on heartbeat |
| Session key gas low | Try `pragma_fund_session_key`, or ask user to send MON manually |
| Sub-agent budget exhausted | Sub-agent reports "completed", main agent announces results |
| Sub-agent failed | Main agent sees on heartbeat, reports error, offers restart |
| Network error | Sub-agent retries 3 times, then pauses and reports |

---

## Security

- Each sub-agent has its own wallet — isolated nonce sequence, no cross-contamination
- Sub-delegation scoped to agent type (kairos: perps only, thymos: nadfun only, pragma: all)
- On-chain enforcement via delegation caveats (value limit, call limit, timestamp)
- User approves delegation via browser (pr4gma.xyz) — cannot be bypassed
- Revocation sweeps remaining gas back to session key
