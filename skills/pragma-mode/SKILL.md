---
name: pragma-mode
description: Switch between BYOK (free, bring your own keys) and x402 (pay per API call) modes.
tools:
  - pragma_has_providers
  - pragma_set_mode
requires:
  - pragma
metadata:
  openclaw:
    requires: ["pragma"]
---

# Pragma Mode — BYOK / x402 Switching

> Switch between free (BYOK) and paid (x402) API modes.

## Modes

| Mode | Description | Cost |
|------|-------------|------|
| **x402** | All API backends provided by Pragma | Pay per API call |
| **BYOK** | Bring your own API keys | Free (you provide everything) |

## Switching

```
User: "switch to byok" / "use free mode" / "bring my own keys"
→ pragma_set_mode({ mode: "byok" })

User: "switch to x402" / "use paid mode" / "use convenience mode"
→ pragma_set_mode({ mode: "x402" })
```

## After Switching

After switching to BYOK, check provider status:
```
pragma_has_providers → Shows which providers are configured
```

If providers are missing, guide the user to configure them.
