---
name: pragma-core
description: Operates pragma wallet for on-chain trading and market intelligence on Monad. Use when user mentions wallet, balance, portfolio, swap, trade, buy, sell, transfer, send, wrap, unwrap, tokens, DeFi, price, chart, market, position, leverage, perps, perpetuals, memecoin, nadfun, nad.fun, leverup, transaction, contract, block, gas, news, economic, forex, currency, MON, USDC, WMON, LVUSD, or any on-chain operation.
tools:
  - pragma_has_wallet
  - pragma_has_providers
  - pragma_setup_wallet
  - pragma_set_mode
  - pragma_get_balance
  - pragma_get_all_balances
  - pragma_list_verified_tokens
  - pragma_get_token_info
  - pragma_get_account_info
  - pragma_check_session_key_balance
  - pragma_fund_session_key
  - pragma_withdraw_session_key
  - pragma_get_swap_quote
  - pragma_execute_swap
  - pragma_transfer
  - pragma_wrap
  - pragma_unwrap
  - pragma_get_block
  - pragma_get_gas_price
  - pragma_explain_transaction
  - pragma_get_onchain_activity
  - pragma_explain_contract
  - pragma_nadfun_status
  - pragma_nadfun_quote
  - pragma_nadfun_buy
  - pragma_nadfun_sell
  - pragma_nadfun_discover
  - pragma_nadfun_token_info
  - pragma_nadfun_positions
  - pragma_nadfun_create
  - pragma_leverup_list_pairs
  - pragma_leverup_list_positions
  - pragma_leverup_get_quote
  - pragma_leverup_open_trade
  - pragma_leverup_close_trade
  - pragma_leverup_update_margin
  - pragma_leverup_update_tpsl
  - pragma_leverup_get_market_stats
  - pragma_leverup_get_funding_rates
  - pragma_leverup_open_limit_order
  - pragma_leverup_list_limit_orders
  - pragma_leverup_cancel_limit_order
  - pragma_market_get_chart
  - pragma_market_get_fx_reference
  - pragma_market_get_currency_strength
  - pragma_market_get_economic_events
  - pragma_market_get_weekly_calendar
  - pragma_market_get_critical_news
  - pragma_market_search_news
  - pragma_market_get_cb_speeches
  - pragma_create_sub_agent
  - pragma_get_sub_agent_state
  - pragma_fund_sub_agent
  - pragma_list_sub_agents
  - pragma_revoke_sub_agent
  - pragma_report_agent_status
  - pragma_get_agent_log
  - pragma_write_agent_memo
requires:
  - pragma
metadata:
  openclaw:
    requires: ["pragma"]
---

# Pragma Core — Trading Skill

> On-chain trading and market intelligence on Monad.

## Critical Rules

1. **Call tools directly.** You MUST call the `pragma_` tools yourself — directly, in this conversation. NEVER spawn sub-agents, background tasks, or delegate to other agents for pragma operations. Sub-agents do not have access to pragma tools and will always fail. You have all the tools you need.

2. **Tool calls only.** ALL on-chain operations MUST use the `pragma_` tools listed below. NEVER run bash commands, create scripts, or use `exec` for blockchain operations. Tool names like `pragma_get_swap_quote` are MCP tool calls, NOT CLI commands — do not try to run them in a shell.

3. **Signing is automatic.** All write operations (swap, transfer, buy, sell, wrap, open trade, etc.) handle signing and delegation internally. You do NOT need to worry about signers, passkeys, Touch ID, or binaries. Just call the tool.

4. **No workarounds.** If a tool call fails, report the error to the user. Do NOT attempt workarounds like writing scripts, running bash commands, spawning sub-agents, or trying alternative approaches.

5. **Delegation is handled.** Before requesting a new delegation, try the operation first. Only use the pragma-delegation skill if a tool returns "Delegation expired" or "No delegation found". Do NOT proactively create delegations before attempting trades.

6. **Use the correct delegation tool.** When you need a new delegation, use `pragma_request_delegation` (the web-based approval flow). NEVER use `pragma_create_root_delegation` — that tool requires macOS Touch ID and will always fail on this platform.

---

## Prerequisites

Before ANY operation, verify wallet status:

```
pragma_has_wallet → if not set up → tell user to run setup first
pragma_get_all_balances → verify sufficient balance for operation
```

**NEVER skip the balance check.** Every trade, swap, or transfer must be preceded by a balance verification.

---

## Delegation Health

You do NOT need to check delegation before every operation — just try the operation. The MCP tools automatically use the stored delegation. But when an error occurs:

| Error from tool | What to do |
|----------------|------------|
| "Delegation expired" | Tell user → use pragma-delegation skill to renew |
| "No delegation found" | Tell user → use pragma-delegation skill to create one |
| "LimitedCalls exceeded" | Delegation used up all allowed calls → renew |

**Session key gas management:**
- **Low gas (> 0.02 MON remaining):** Use `pragma_fund_session_key` — it transfers MON from the user's Smart Account to the session key via delegation. No extra approval needed.
- **Zero gas (< 0.02 MON):** Self-funding CANNOT work because the session key needs gas to submit the funding transaction. Tell the user: "Your session key is out of gas. Please send at least 0.5 MON to: [session key address]"
- **No UserOp on this platform.** The bundler/UserOp path is not available here. Do NOT mention UserOp to the user.

---

## Tool Reference (54 Tools)

### Wallet & Account

| Tool | Purpose |
|------|---------|
| `pragma_has_wallet` | Check if wallet is configured |
| `pragma_has_providers` | Check API provider status |
| `pragma_setup_wallet` | Initialize wallet (file-based signer) |
| `pragma_set_mode` | Switch between BYOK and x402 modes |
| `pragma_get_account_info` | Smart Account address and details |
| `pragma_check_session_key_balance` | Session key gas balance |
| `pragma_fund_session_key` | Transfer MON/USDC from SA to session key via delegation |
| `pragma_withdraw_session_key` | Withdraw gas from session key |

### Balances & Tokens

| Tool | Purpose |
|------|---------|
| `pragma_get_balance` | Single token balance |
| `pragma_get_all_balances` | Full portfolio (all token balances) |
| `pragma_list_verified_tokens` | All verified tokens on Monad |
| `pragma_get_token_info` | Token metadata (name, symbol, decimals) |

### DeFi Operations

| Tool | Purpose |
|------|---------|
| `pragma_get_swap_quote` | Get swap quote from DEX aggregator |
| `pragma_execute_swap` | Execute token swap |
| `pragma_transfer` | Send tokens to address |
| `pragma_wrap` | MON → WMON |
| `pragma_unwrap` | WMON → MON |

### nad.fun (Memecoins)

| Tool | Purpose |
|------|---------|
| `pragma_nadfun_status` | Bonding curve progress, market cap, volume |
| `pragma_nadfun_quote` | Buy/sell price quotes |
| `pragma_nadfun_buy` | Buy tokens on bonding curve |
| `pragma_nadfun_sell` | Sell tokens from bonding curve |
| `pragma_nadfun_discover` | Trending tokens (by market cap, creation, latest trade) |
| `pragma_nadfun_token_info` | Token details, creator, metadata |
| `pragma_nadfun_positions` | Current holdings and unrealized PnL |
| `pragma_nadfun_create` | Launch new token on bonding curve |

### LeverUp (Perpetuals)

| Tool | Purpose |
|------|---------|
| `pragma_leverup_list_pairs` | Available pairs, prices, spreads |
| `pragma_leverup_list_positions` | Open positions, PnL, margin, liq distance |
| `pragma_leverup_get_quote` | Position quote (margin, fees, liq price) |
| `pragma_leverup_open_trade` | Open market position |
| `pragma_leverup_close_trade` | Close position |
| `pragma_leverup_update_margin` | Add/remove margin |
| `pragma_leverup_update_tpsl` | Update TP/SL levels |
| `pragma_leverup_get_market_stats` | OI, volume, spread per pair |
| `pragma_leverup_get_funding_rates` | Holding fee rates (carry cost) |
| `pragma_leverup_open_limit_order` | Place limit order |
| `pragma_leverup_list_limit_orders` | Pending limit orders |
| `pragma_leverup_cancel_limit_order` | Cancel limit order |

### Market Intelligence

| Tool | Purpose | x402 Cost |
|------|---------|-----------|
| `pragma_market_get_chart` | Price charts (Pyth Benchmark) | $0.005 |
| `pragma_market_get_fx_reference` | FX reference rates | $0.005 |
| `pragma_market_get_currency_strength` | Currency strength analysis | $0.01 |
| `pragma_market_get_economic_events` | Economic calendar | $0.01 |
| `pragma_market_get_weekly_calendar` | Weekly calendar by day | $0.005 |
| `pragma_market_get_critical_news` | Breaking/critical news | $0.02 |
| `pragma_market_search_news` | Search news by keyword | $0.015 |
| `pragma_market_get_cb_speeches` | Central bank communications | $0.01 |

### Chain Data

| Tool | Purpose |
|------|---------|
| `pragma_get_block` | Block number and timestamp |
| `pragma_get_gas_price` | Current gas prices |
| `pragma_explain_transaction` | Decode any transaction hash |
| `pragma_get_onchain_activity` | Transaction history for any address |

### Contract Analysis

| Tool | Purpose |
|------|---------|
| `pragma_explain_contract` | Analyze and explain smart contract |

### Sub-Agent Management (8)

| Tool | Purpose |
|------|---------|
| `pragma_create_sub_agent` | Create sub-agent with scoped delegation + wallet |
| `pragma_get_sub_agent_state` | Budget, trades, gas, errors, loop config |
| `pragma_fund_sub_agent` | Transfer MON from session key to sub-agent wallet |
| `pragma_list_sub_agents` | List all sub-agents and status |
| `pragma_revoke_sub_agent` | Revoke delegation, sweep balance, cleanup |
| `pragma_report_agent_status` | Sub-agent reports running/paused/completed/failed |
| `pragma_get_agent_log` | Read sub-agent journal entries (paginated, filterable by tag) |
| `pragma_write_agent_memo` | Write structured memo to sub-agent journal |

---

## Operation Flows

### Swap (Single)

```
1. pragma_get_all_balances             → Verify source token balance
2. pragma_get_swap_quote(from, to, amount) → Show quote to user
3. pragma_execute_swap(from, to, amount)   → Execute after confirmation
4. pragma_get_all_balances             → Confirm new balances
```

### Swap (Batch)

For multiple swaps in sequence:

```
1. pragma_get_all_balances             → Portfolio snapshot
2. For each swap:
   a. pragma_get_swap_quote(...)       → Get quote
   b. pragma_execute_swap(...)         → Execute
3. pragma_get_all_balances             → Final portfolio
```

### Transfer

```
1. pragma_get_balance(token)           → Verify sufficient balance
2. pragma_transfer(token, to, amount)  → Execute transfer
3. pragma_get_balance(token)           → Confirm new balance
```

### Wrap / Unwrap

```
1. pragma_get_all_balances             → Check MON/WMON balance
2. pragma_wrap(amount) or pragma_unwrap(amount)
3. pragma_get_all_balances             → Confirm
```

### nad.fun Buy

```
1. pragma_get_all_balances             → Verify MON balance
2. pragma_nadfun_token_info(address)   → Token details
3. pragma_nadfun_status(address)       → Bonding curve progress
4. pragma_nadfun_quote(address, "buy", amount) → Price quote
5. pragma_nadfun_buy(address, amount)  → Execute buy
6. pragma_nadfun_positions             → Confirm position
```

### nad.fun Sell

```
1. pragma_nadfun_positions             → Current holdings
2. pragma_nadfun_quote(address, "sell", amount) → Price quote
3. pragma_nadfun_sell(address, amount) → Execute sell
4. pragma_nadfun_positions             → Confirm
```

### LeverUp Open Position

```
1. pragma_get_all_balances             → Verify LVUSD/collateral balance
2. pragma_leverup_list_pairs           → Current prices and spreads
3. pragma_leverup_get_quote(pair, direction, leverage, size) → Quote
4. pragma_leverup_open_trade(pair, direction, leverage, size, tp, sl)
5. pragma_leverup_list_positions       → Confirm position opened
```

### LeverUp Close Position

```
1. pragma_leverup_list_positions       → Find position to close
2. pragma_leverup_close_trade(positionId) → Close
3. pragma_get_all_balances             → Confirm PnL settled
```

### Limit Order

```
1. pragma_leverup_list_pairs           → Current prices
2. pragma_leverup_get_quote(pair, direction, leverage, size) → Quote at target
3. pragma_leverup_open_limit_order(pair, direction, leverage, size, triggerPrice, tp, sl)
4. pragma_leverup_list_limit_orders    → Confirm order placed
```

---

## Token Resolution

Tokens can be specified by:
1. **Symbol** — `MON`, `USDC`, `WMON`, `LVUSD`
2. **Name** — `Monad`, `USD Coin`
3. **Address** — `0x...` (full contract address)

The MCP server handles resolution automatically. Use `pragma_list_verified_tokens` if the user asks about available tokens.

---

## Error Handling

| Error | Action |
|-------|--------|
| "Wallet not configured" | Tell user to run setup |
| "Insufficient balance" | Show current balance, suggest amount adjustment |
| "Slippage exceeded" | Retry with higher slippage or smaller amount |
| "Delegation expired" | Tell user to approve a new delegation |
| "Rate limited" | Wait and retry |
| "Network error" | Retry once, then report |

---

## Confirmation Rules

**Always confirm before execution:**
- Swaps over $50 value
- Transfers of any amount
- Opening leveraged positions
- Any action that moves funds

**Show the user:**
- What will happen (action + amounts)
- Current price / quote
- Expected outcome
- Any fees or slippage

**Execute without extra confirmation:**
- Balance checks
- Quote requests
- Market data queries
- Token info lookups
- Read-only operations
