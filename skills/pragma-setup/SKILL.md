---
name: pragma-setup
description: First-time onboarding for Pragma. Use when user needs to set up their wallet, configure the plugin, or hasn't used Pragma before.
tools:
  - pragma_has_wallet
  - pragma_has_providers
  - pragma_setup_wallet
  - pragma_set_mode
  - pragma_get_account_info
  - pragma_get_all_balances
  - pragma_check_session_key_balance
  - pragma_setup_session
requires:
  - pragma
metadata:
  openclaw:
    requires: ["pragma"]
---

# Pragma Setup — Onboarding

> First-time setup for Pragma on OpenClaw.

## When This Skill Activates

- User says "set up pragma", "configure wallet", "get started"
- `pragma_has_wallet` returns false
- First interaction with any pragma tool fails due to missing wallet

---

## Onboarding Flow

### Step 1: Check Current State

```
pragma_has_wallet
  → true (with SA set): Skip to Step 5 (verify setup)
  → true (no SA): Skip to Step 3 (ask for SA address)
  → false: Continue to Step 2
```

### Step 2: Initialize Session Key

```
pragma_setup_wallet
  → Creates file-based session key at ~/.pragma/session-key.json
  → Creates config at ~/.pragma/config.json
  → Returns: { sessionKeyAddress, smartAccountAddress: "not set" }
```

The session key is the agent's wallet — it will execute trades on behalf of the user.

### Step 3: Get User's Smart Account Address

The user needs a Pragma Smart Account. This is their on-chain wallet that the agent trades through.

```
Tell user:
  "Session key created: [sessionKeyAddress]

   Now I need your Smart Account (SA) address to connect.

   If you already have one, paste the 0x... address here.

   If you don't have one yet, create it at:
   https://pr4gma.xyz/setup

   It only takes a minute — just connect with your passkey."
```

Wait for user to provide their SA address (0x...).

### Step 4: Register Session Key

```
pragma_setup_session({ sa: "<user's SA address>" })
  → Registers session key with Pragma API
  → Links session key to user's Smart Account
  → Unlocks 50 free bootstrap API calls (x402 mode)
```

**Important:** Registration gives the session key 50 free x402 API calls. This means the agent can immediately check balances, get quotes, and fetch market data without the user needing to fund anything upfront.

Tell the user:
  "Session key registered and linked to your Smart Account.
   You have 50 free API calls to get started."

### Step 5: Verify Setup

```
pragma_get_all_balances → Portfolio check
pragma_check_session_key_balance → Gas check
```

Show the user their portfolio summary and session key gas balance.

If session key gas is low (< 0.1 MON):
  "Your session key needs gas to execute transactions.
   Send at least 0.5 MON to: [session key address]"

**Gas funding rules for this platform:**
- **First time (no delegation yet):** User must send MON manually to the session key address. There is no other way.
- **After delegation is active:** Use `pragma_fund_session_key` to auto-transfer MON from SA → session key via delegation.
- **Zero gas emergency:** If session key hits 0 MON, self-funding can't work (needs gas to submit the tx). Ask user to send MON manually.
- **No UserOp on this platform.** Do not mention UserOp or bundler to the user.

### Step 6: Create Trading Delegation

If the user already has a delegation stored at `~/.pragma/delegations/root/delegation.json`, skip this step — the MCP tools will use it automatically.

The user needs a delegation to authorize trading. Use the **pragma-delegation** skill.

The delegation skill will:
1. Ask the user what they want to trade (maps to protocol scopes automatically)
2. Set duration, limits, and gas budget using smart defaults
3. Submit the delegation request with proper on-chain caveats (includes transfer groups for session key self-funding by default)
4. Send the user an approval link to sign with their passkey
5. Poll for approval and retrieve the signed delegation
6. Verify the delegation works with a small test transaction

```
Tell user:
  "Now let's set up your trading authorization.
   I'll ask you a few questions about what you'd like me to trade."
```

Follow the pragma-delegation skill flow from Step 2 onward.

### Step 7: Done

After delegation is active:

```
Tell user:
  "Setup complete!

   Smart Account: [SA address]
   Session Key: [session key address]
   Delegation: Active until [expiry]
   Portfolio: [summary]

   You can now ask me to trade, check prices, or monitor markets.
   Try: 'show my portfolio' or 'what's trending on nad.fun?'"
```

---

## Mode Configuration

Default mode is **x402** (paid convenience). The user can switch to BYOK (free, bring your own keys) at any time using the **pragma-mode** skill.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Wallet not found" | Run setup from Step 2 |
| "Session key not registered" | Run `pragma_setup_session` with SA address |
| "Delegation expired" | Use pragma-delegation skill to create new delegation |
| "Insufficient gas" | "Send MON to session key: [address]" |
| "No balance" | "Send tokens to Smart Account: [address]" |
| "Bootstrap calls exhausted" | User needs to fund session key for x402 payments |
