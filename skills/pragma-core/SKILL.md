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

7. **On retry, re-pass ALL parameters.** If a tool call fails and you retry, include EVERY parameter from the original call. Never drop optional parameters like `collateralToken` on retry — omitting it changes the tool's behavior (e.g., defaulting to MON collateral instead of LVUSD).

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

---

## Session Key Gas Management

**MANDATORY: Check session key balance before ANY write operation.**

### Pre-Transaction Check

Before every swap, transfer, wrap, unwrap, buy, sell, or open/close trade:

```
1. pragma_check_session_key_balance (with operationType or estimatedOperations)
2. If needsFunding: pragma_fund_session_key → WAIT for result
3. THEN execute the operation
```

### Gas Cost Reference

| Operation | Gas Cost (MON) |
|-----------|---------------|
| swap | 0.14 |
| transfer | 0.04 |
| wrap / unwrap | 0.04 |
| leverup open / close | 0.14 |
| nadfun buy / sell | 0.14 |

**Formula:** `total_gas = sum(operation_costs) + 0.02 MON buffer`

**Example:** Swap + transfer = 0.14 + 0.04 + 0.02 buffer = **0.20 MON needed**

### Funding Rule

**NEVER call `pragma_fund_session_key` and execution tools simultaneously.**

The session key needs funds BEFORE it can pay gas. Always fund first, wait for completion, then execute.

### Gas Thresholds

- **Low gas (> 0.02 MON remaining):** Use `pragma_fund_session_key` — transfers MON from Smart Account via delegation. No extra approval needed.
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
| `pragma_leverup_update_margin` | Add margin (normal leverage only) |
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

## LeverUp Platform Constraints

**CRITICAL: Always perform a risk simulation (`pragma_leverup_get_quote`) before opening any position.**

### Two Trading Modes

| Feature | Normal Mode (1-100x) | Zero-Fee Mode (500x/750x/1001x) |
|---------|----------------------|----------------------------------|
| **Pairs** | All standard pairs (BTC, ETH, MON, etc.) | 500BTC/USD, 500ETH/USD only |
| **Open/Close Fees** | 0.045% | 0% if PnL < 0, profit sharing if profitable |
| **Order Types** | Market + Limit | **Market only** |
| **Add/Remove Margin** | Yes | **Not allowed** |
| **Leverage Values** | Any from 1-100 | **Exactly 500, 750, or 1001** |

**CRITICAL:** If user requests 500BTC or 500ETH, they MUST use exactly 500x, 750x, or 1001x leverage. Any other value will fail with "Below degen mode min leverage" error.

### Order Types: Market vs Limit

| Order Type | When to Use | Trigger Behavior |
|------------|-------------|------------------|
| **Market** (`pragma_leverup_open_trade`) | Execute immediately at current price | Fills instantly |
| **Limit** (`pragma_leverup_open_limit_order`) | Wait for better entry price | Triggers when market reaches price |

**Limit Order Trigger Rules:**
- **Long limit orders:** Trigger price must be BELOW current market (buy the dip)
- **Short limit orders:** Trigger price must be ABOVE current market (sell the top)

**Limit orders are NOT available for Zero-Fee pairs (500BTC/500ETH).**

### Minimum Trade Thresholds

LeverUp enforces the following limits. Always inform the user if their trade is near or below these thresholds.

- **HARD LIMIT — Minimum Position Size**: $200.00 USD (Margin x Leverage) — **Contract will reject trades below this**
- **Soft Guideline — Minimum Margin**: $10.00 USD (recommended but not strictly enforced)

### Collateral Options

**CRITICAL: Always pass the `collateralToken` parameter explicitly when opening LeverUp trades. Never omit it — the default (MON) may not be what the user intends.**

| Token | Decimals | When to Use |
|-------|----------|-------------|
| **MON** (native) | 18 | Default — full amount sent as native value |
| **USDC** | 6 | Stablecoin strategies |
| **LVUSD** | 18 | LeverUp vault USD token |
| **LVMON** | 18 | LeverUp vault MON token |

**On retry after failure:** You MUST re-pass `collateralToken` with the same value. Dropping it changes behavior (defaults to MON, which sends full amount as native value and may hit delegation limits).

### Stop Loss (SL) and Take Profit (TP)

SL and TP can be set when opening a position. Both are optional (set to 0 to disable).

**TP Limits (Contract-Enforced):**

| Leverage | Max Take Profit |
|----------|-----------------|
| < 50x | 500% profit |
| >= 50x | 300% profit |

**SL/TP Rules:**

- Stop Loss: Must be BELOW entry price (Long) or ABOVE entry price (Short)
- Take Profit: Must be ABOVE entry price (Long) or BELOW entry price (Short)
- **Cannot be cancelled** once set, but can be edited via `pragma_leverup_update_tpsl`
- Prices are in USD (e.g., "85000" for $85,000)

**Example — Long BTC at $90,000:**
- Valid SL: $85,000 (below entry)
- Valid TP: $100,000 (above entry, within 500%/300% limit)

**Example — Short BTC at $90,000:**
- Valid SL: $95,000 (above entry)
- Valid TP: $80,000 (below entry)

### Managing Positions

1. `pragma_leverup_list_positions` — Check Health Factor of active trades.
2. If Health < 20%: Suggest `pragma_leverup_update_margin` to add collateral.
   - **NOTE:** This does NOT work for 500x/750x/1001x positions!
3. To update TP/SL: Use `pragma_leverup_update_tpsl`.
4. To lock in profit: Use `pragma_leverup_close_trade`.

### Update Margin Limitations

`pragma_leverup_update_margin` only works for normal leverage (1-100x) positions.

- **Only ADDING margin is supported** — the contract does not allow margin withdrawal.
- **Zero-Fee positions (500x/750x/1001x) CANNOT add margin.**
- The tool will show a warning, and the contract will reject the transaction if attempted.

### Update TP/SL

Use `pragma_leverup_update_tpsl` to modify take profit and stop loss on existing positions:

- Pass price in USD (e.g., '110000' for $110,000)
- Set to '0' to disable TP or SL
- At least one of `takeProfit` or `stopLoss` must be provided
- Works for all position types including Zero-Fee positions

### Managing Limit Orders

1. `pragma_leverup_list_limit_orders` — View all pending orders (not yet filled)
2. `pragma_leverup_cancel_limit_order` — Cancel one or more pending orders
   - Accepts single orderHash or array for batch cancel
   - Use batch cancel when user wants to "cancel all orders"

**Distinction:**
- `pragma_leverup_list_positions` → FILLED positions (active trades)
- `pragma_leverup_list_limit_orders` → PENDING orders (waiting to trigger)

---

## Operation Flows

### Swap (Single)

```
1. pragma_get_all_balances             → Verify source token balance
2. pragma_check_session_key_balance    → Verify gas (operationType: "swap")
3. If needsFunding: pragma_fund_session_key → WAIT
4. pragma_get_swap_quote(from, to, amount) → Show quote to user
5. pragma_execute_swap(from, to, amount)   → Execute after confirmation
6. pragma_get_all_balances             → Confirm new balances
```

### Swap (Batch)

For multiple independent swaps:

```
1. pragma_get_all_balances             → Portfolio snapshot
2. pragma_check_session_key_balance    → estimatedOperations: N
3. If needsFunding: pragma_fund_session_key → WAIT
4. For each swap:
   a. pragma_get_swap_quote(...)       → Get quote
   b. pragma_execute_swap(...)         → Execute
5. pragma_get_all_balances             → Final portfolio
```

### Transfer

```
1. pragma_get_balance(token)           → Verify sufficient balance
2. pragma_check_session_key_balance    → operationType: "transfer"
3. If needsFunding: pragma_fund_session_key → WAIT
4. pragma_transfer(token, to, amount)  → Execute transfer
5. pragma_get_balance(token)           → Confirm new balance
```

### Wrap / Unwrap

```
1. pragma_get_all_balances             → Check MON/WMON balance
2. pragma_check_session_key_balance    → operationType: "wrap" or "unwrap"
3. If needsFunding: pragma_fund_session_key → WAIT
4. pragma_wrap(amount) or pragma_unwrap(amount)
5. pragma_get_all_balances             → Confirm
```

### nad.fun Buy

```
1. pragma_get_all_balances             → Verify MON balance
2. pragma_nadfun_token_info(address)   → Token details
3. pragma_nadfun_status(address)       → Bonding curve progress
4. pragma_nadfun_quote(address, "buy", amount) → Price quote
5. pragma_check_session_key_balance    → operationType: "swap"
6. If needsFunding: pragma_fund_session_key → WAIT
7. pragma_nadfun_buy(address, amount)  → Execute buy
8. pragma_nadfun_positions             → Confirm position
```

### nad.fun Sell

```
1. pragma_nadfun_positions             → Current holdings
2. pragma_nadfun_quote(address, "sell", amount) → Price quote
3. pragma_check_session_key_balance    → operationType: "swap"
4. If needsFunding: pragma_fund_session_key → WAIT
5. pragma_nadfun_sell(address, amount) → Execute sell
6. pragma_nadfun_positions             → Confirm
```

### LeverUp Open Position

```
1. pragma_get_all_balances             → Verify collateral balance
2. pragma_leverup_list_pairs           → Current prices and spreads
3. pragma_leverup_get_quote(pair, direction, leverage, margin) → MANDATORY quote
4. Review: Check minimum thresholds, Zero-Fee restrictions, warnings
5. Confirm with user: Show margin, position size, liq price, collateral token
6. pragma_check_session_key_balance    → operationType: "swap"
7. If needsFunding: pragma_fund_session_key → WAIT
8. pragma_leverup_open_trade(pair, direction, leverage, margin, collateralToken, tp, sl)
   ↑ ALWAYS pass collateralToken explicitly
9. pragma_leverup_list_positions       → Confirm position opened
```

### LeverUp Close Position

```
1. pragma_leverup_list_positions       → Find position to close
2. pragma_check_session_key_balance    → operationType: "swap"
3. If needsFunding: pragma_fund_session_key → WAIT
4. pragma_leverup_close_trade(positionId) → Close
5. pragma_get_all_balances             → Confirm PnL settled
```

### Limit Order

```
1. pragma_leverup_get_market_stats     → Current prices
2. pragma_leverup_get_quote(pair, direction, leverage, margin) → Quote at target
3. Confirm trigger price with user (Long: below market, Short: above market)
4. pragma_check_session_key_balance    → operationType: "swap"
5. If needsFunding: pragma_fund_session_key → WAIT
6. pragma_leverup_open_limit_order(pair, direction, leverage, margin, triggerPrice, collateralToken, tp, sl)
   ↑ ALWAYS pass collateralToken explicitly
7. pragma_leverup_list_limit_orders    → Confirm order placed
```

**Note:** SL/TP for limit orders are validated against the TRIGGER price, not current market.

---

## Token Resolution

Tokens can be specified by:
1. **Symbol** — `MON`, `USDC`, `WMON`, `LVUSD`
2. **Name** — `Monad`, `USD Coin`
3. **Address** — `0x...` (full contract address)

The MCP server handles resolution automatically. Use `pragma_list_verified_tokens` if the user asks about available tokens.

---

## Relative Amounts

When user says "all", "half", "max", or a percentage:

1. `pragma_get_balance` FIRST to get actual amount
2. Calculate the relative value
3. Proceed with the appropriate operation flow

---

## Error Handling

| Error | Action |
|-------|--------|
| "Wallet not configured" | Tell user to run setup |
| "Insufficient balance" | Show current balance, suggest amount adjustment |
| "Slippage exceeded" | Retry with higher slippage or smaller amount |
| "Delegation expired" | Tell user to approve a new delegation |
| "LimitedCalls exceeded" | Delegation used up all allowed calls → renew |
| "ValueLteEnforcer:value-too-high" | Collateral token likely wrong — check `collateralToken` param |
| "Position is too small" | Margin x Leverage < $200 — increase margin or leverage |
| "Below degen mode min leverage" | Zero-Fee pairs need exactly 500x, 750x, or 1001x |
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

**Unverified token warning:**
- If token is NOT in `pragma_list_verified_tokens`, show FULL contract address
- Include warning: "This token is unverified. Verify this is the correct contract address."
- This prevents users from swapping to copycat/scam tokens with the same symbol

**Execute without extra confirmation:**
- Balance checks
- Quote requests
- Market data queries
- Token info lookups
- Read-only operations

---

## Response Format

**Balances:**
```
Token: Amount ($Value)
```

**Quotes:**
```
Swap: 1 TOKEN_A → 0.999 TOKEN_B
Impact: 0.1%
Route: Direct
```

**Results:**
```
Success!
Tx: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Received: 0.999 TOKEN_B
```

**IMPORTANT:** Always show FULL transaction hashes (all 66 characters). Never truncate tx hashes — users need to copy them.
