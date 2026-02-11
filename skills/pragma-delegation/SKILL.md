---
name: pragma-delegation
description: Creates, renews, and manages on-chain trading delegations. Use when user needs to authorize trading, delegation expired, user wants to change trading scope, or after initial setup.
tools:
  - pragma_has_wallet
  - pragma_get_account_info
  - pragma_get_all_balances
  - pragma_check_session_key_balance
  - pragma_setup_session
  - pragma_request_delegation
  - pragma_poll_delegation
  - pragma_retrieve_delegation
  - pragma_wrap
requires:
  - pragma
metadata:
  openclaw:
    requires: ["pragma"]
---

# Pragma Delegation — Trading Authorization

> Creates and manages on-chain delegations that authorize the agent to trade on behalf of the user.

## What Is a Delegation?

A delegation is a signed on-chain permission from the user that lets you (the agent) trade through their Smart Account. Think of it like a power of attorney with built-in limits.

**What the user is signing:**
- Which actions you can perform (swap, trade perps, buy memecoins, etc.)
- How long the permission lasts (e.g., 7 days)
- Maximum MON per single transaction (e.g., 1 MON — this caps any single trade)
- Total number of transactions allowed (e.g., 100)
- Who can receive transfers (session key only, by default)

**What you cannot do even with a delegation:**
- Exceed the value limit per transaction
- Call contracts not in the allowed list
- Operate after the delegation expires
- Transfer to addresses not whitelisted

The user approves by signing with their passkey at pr4gma.xyz. You cannot bypass or modify the scope after signing.

---

## When This Skill Activates

- After initial setup (pragma-setup completed, delegation needed)
- A `pragma_` tool returns "Delegation expired" or "No delegation found"
- User wants to change trading scope
- User explicitly asks to "delegate", "authorize", "set permissions"

---

## Step 0: Check Existing Delegation

Before creating a new delegation, check if one already exists. The MCP tools automatically use the stored delegation at `~/.pragma/delegations/root/delegation.json`.

**ONLY create a new delegation if:**
- A `pragma_` tool returns "Delegation expired" or "No delegation found"
- The user explicitly asks to create or renew a delegation
- This is the first-time setup flow (no delegation has ever been created)

**DO NOT** create a new delegation just because you're about to perform a trade. Try the trade first — the existing delegation is used automatically.

---

## Step 1: Prerequisites

```
pragma_has_wallet → Must be true (if not, direct to pragma-setup first)
pragma_get_account_info → Need the Smart Account address
pragma_check_session_key_balance → Need gas (> 0.1 MON)
```

If session key gas is low, tell the user:
  "Your session key needs gas to execute transactions.
   Send at least 0.5 MON to: [session key address]"

---

## Step 2: Understand What the User Wants

**DO NOT dump a list of presets.** Instead, ask a simple question:

> "What would you like me to be able to do? For example: trade memecoins, do leveraged trading, swap tokens, or everything?"

Then map the user's intent to the right scope:

| User says... | You should use | Why |
|-------------|----------------|-----|
| "trade memecoins" / "snipe" / "nad.fun" | `["nadfun", "dex", "wmon"]` | Buying on bonding curve needs nadfun. Selling graduated tokens needs DEX. Wrapping needed for MON→WMON. |
| "perps" / "leverage" / "leverup" | `["leverup", "dex", "wmon"]` | Perps need leverup. DEX for collateral swaps (MON↔LVUSD). Wrapping for MON. |
| "swap tokens" / "spot trading" | `["dex", "wmon"]` | DEX for swaps. Wrapping for MON↔WMON. |
| "everything" / "full access" / no preference | `["dex", "leverup", "nadfun", "wmon"]` | All protocols. |
| Specific protocol names | Map directly | User knows what they want. |

**Important:** `wmon` (wrap/unwrap) should almost always be included — most operations need MON↔WMON conversion at some point.

---

## Step 3: Set Parameters (Smart Defaults)

Ask the user about limits using **plain language**, not parameter names. Use their portfolio to suggest smart defaults:

```
pragma_get_all_balances → Check portfolio size
```

### Duration

> "How long should this authorization last?"

| User says | `expiryDays` value |
|-----------|-------------------|
| "a few hours" / "just today" | 1 |
| "a week" / nothing specified | 7 (default) |
| "a month" / "longer" | 30 |

### Max value per transaction

> "What's the most MON I should be able to use in a single transaction?"

**Smart defaults based on portfolio:**

| Portfolio MON balance | Suggested `maxValuePerTxMon` |
|----------------------|------------------------------|
| < 5 MON | 0.5 |
| 5–50 MON | 1 (default) |
| 50–500 MON | 5 |
| > 500 MON | 10 |

Explain it simply:
> "This caps any single trade at [X] MON. You have [Y] MON in your portfolio, so I'd suggest [Z] as the limit. Sound good?"

### Max transactions

> "How many transactions should I be allowed to make?"

| Usage pattern | Suggested `maxCalls` |
|--------------|---------------------|
| Casual / first time | 50 |
| Active trading | 100 (default) |
| Autonomous / long duration | 500 |
| Heavy usage | 1000 |

Explain it simply:
> "This is the total number of on-chain actions I can take — each swap, trade open/close, or approval counts as one. I'd suggest [X] for [duration] days."

### Transfer recipients

Transfers to the session key are enabled by default — this lets the agent fund its own gas. You don't need to ask the user about this unless they specifically want to restrict transfers.

If the user asks about transfers to other addresses:
> "By default, I can only transfer tokens to my own session key (for gas). Want to add other addresses I can send to?"

---

## Step 4: Confirm Before Submitting

Summarize in plain language:

```
"Here's what I'm requesting permission for:

 What I can do: [plain description, e.g., 'swap tokens, trade perps, and buy memecoins']
 Duration: [X] days (expires [date])
 Max per trade: [X] MON
 Max transactions: [X] total
 Self-funding: Enabled (I can send tokens/MON to my session key for gas)

 You'll get a link to approve this in your browser.
 Want me to proceed?"
```

Wait for user confirmation.

---

## Step 5: Submit Delegation Request

```
pragma_request_delegation({
  sa: "<user's Smart Account address>",
  protocols: ["dex", "leverup", "nadfun", "wmon"],
  expiryDays: 7,
  maxCalls: 100,
  maxValuePerTxMon: 1,
  budgetMon: 1,
  description: "Full trading suite - 7 days"
})
→ Returns: { requestId, approvalUrl }
```

Send the approval URL with a clear explanation:

```
"Please approve this in your browser:
 [approvalUrl]

 What you're signing: A time-limited permission for me to trade
 on your behalf with the limits we just discussed. I cannot
 exceed these limits — they're enforced on-chain.

 The link expires in 30 minutes."
```

---

## Step 6: Poll for Approval

```
Poll every 30 seconds (max 30 minutes):
  pragma_poll_delegation({ requestId })
  → "pending": Continue polling silently
  → "approved": Continue to Step 7
  → "rejected": "Delegation rejected. Want to try different settings?"
  → "expired": "The approval link expired. I'll create a new one."
```

If the user hasn't approved after 5 minutes, send a gentle reminder:
  "Still waiting for your approval. Open this link when ready: [approvalUrl]"

---

## Step 7: Retrieve, Verify, and Activate

```
pragma_retrieve_delegation({ requestId })
→ Signed delegation stored at ~/.pragma/delegations/root/delegation.json
```

**Verify the delegation works** with a small test:

```
pragma_wrap({ amount: "0.001" })
→ If this succeeds, the delegation is working correctly
→ If this fails with "No delegation found", something went wrong with storage
```

Then show the user:

```
pragma_get_all_balances → Portfolio snapshot

"Delegation active and verified!

 Valid until: [expiry date]
 Scope: [what you can do]
 Transactions remaining: [maxCalls]
 Portfolio: [summary]

 You can now ask me to trade. Try: 'what's trending on nad.fun?' or 'show my positions'"
```

---

## Delegation Renewal

When a delegation is expiring or expired:

1. Check if the user wants the same scope or different
2. If same scope, skip Step 2-3 and go straight to Step 5 with the same parameters
3. If different scope, go through Steps 2-5

```
"Your trading authorization expires in [X hours / has expired].
 Want me to renew with the same settings, or change anything?"
```

For autonomous mode: if the user doesn't respond within 30 minutes and the delegation is about to expire, close any open positions before the delegation expires.

---

## Protocol Reference

| Protocol | What it does | Common operations |
|----------|-------------|-------------------|
| `dex` | Token swaps via DEX aggregator | Swap MON→USDC, swap any token pair |
| `leverup` | Leveraged perpetual trading | Open/close positions, set TP/SL, limit orders |
| `nadfun` | Memecoin trading on bonding curves | Buy/sell memecoins on nad.fun |
| `wmon` | MON↔WMON wrapping | Convert native MON to wrapped MON and back |

**Automatically included in every delegation (no configuration needed):**
- ERC-20 token approvals (needed before swaps/trades)
- ERC-20 transfers to session key (for self-funding with tokens)
- Native MON transfers to session key (for gas self-funding)

---

## Error Handling

| Error | What to tell the user |
|-------|----------------------|
| "Wallet not configured" | "You need to set up your wallet first. Say 'set up pragma' to get started." |
| "Session key not registered" | "Your session key needs to be linked to your Smart Account. Let me fix that." → Run `pragma_setup_session` |
| "Invalid Smart Account" | "That doesn't look like a valid Smart Account address. Can you double-check?" |
| "Approval link expired" | "The link expired — let me create a fresh one." → Re-run Step 5 |
| "Delegation rejected" | "No problem. Want to try with different settings, or skip for now?" |
| "API error" | Retry once silently. If still fails: "Having trouble reaching the server. Let's try again in a moment." |
