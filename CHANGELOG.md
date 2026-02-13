# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-02-13

### Fixed
- Sync MCP server v0.8.53 — remove arbitrary `.max()` caps on delegation budget fields (`budgetMon`, `budgetUsd`, `maxValuePerTx`)

## [0.1.5] - 2026-02-12

### Added
- Hackathon filter for `nadfun_discover` — `sortBy: "hackathon"` returns Moltiverse hackathon submissions with team info, project descriptions, and member GitHub/Twitter data

## [0.1.4] - 2026-02-12

### Added
- Social Intelligence tools — 5 new x402 tools for X/Twitter data: `x_search`, `x_get_tweet`, `x_get_user`, `x_get_replies`, `x_get_user_tweets`
- Updated all 3 agent definitions (kairos 34→39, thymos 25→30, pragma 46→51)

## [0.1.3] - 2026-02-12

### Added
- pragma-core skill: LeverUp platform constraints (two trading modes, zero-fee 500x/750x/1001x, $200 minimum position, collateral options, SL/TP rules, limit order trigger rules, margin update limitations)
- pragma-core skill: session key gas management workflow (mandatory pre-transaction check, gas cost table, funding rule)
- pragma-core skill: retry parameter persistence rule (Critical Rule 7)
- pragma-core skill: unverified token warning, relative amount handling, response format standards
- pragma-core skill: expanded error handling (ValueLteEnforcer, position too small, degen mode leverage)
- kairos + pragma agents: collateral tokens reference table, retry parameter persistence rule

### Changed
- pragma-core skill: all 9 operation flows now include mandatory session key gas check
- pragma-core skill: LeverUp flows now require explicit collateralToken and mandatory quote

## [0.1.2] - 2026-02-12

### Changed
- kairos agent: full 7-phase institutional trading workflow with 11-point kill switch checklist, mandatory bear case, 5-timeframe top-down analysis, market hours awareness, LeverUp platform constraints, context compaction recovery, and 17 risk management rules (261 → 672 lines)
- thymos agent: complete 5-phase momentum trading workflow with sleep enforcement, narrative scanner, creator due diligence, monitoring cost budget, tranched profit-taking, and budget depletion thresholds (200 → 289 lines)
- pragma agent: full 5-phase conditional execution framework with monitoring intervals, sleep enforcement, 4 example use cases, and structured communication format (248 → 308 lines)
- all agents: replaced Claude Code `Bash()` references with OpenClaw `exec()` tool
- all agents: removed Claude Code-specific SendMessage/TeammateTool references

## [0.1.1] - 2026-02-11

### Fixed
- plugin id mismatch — changed from `pragma` to `pragma-openclaw` to match npm package name, fixing OpenClaw config validation error on install

## [0.1.0] - 2026-02-11

initial release. bundles pragma-mcp v0.8.50.

### Added
- OpenClaw plugin with MCP tool bridge — spawns pragma-mcp as stdio child process, registers all tools individually with OpenClaw API
- file-mode signer for headless operation on Linux (no macOS Keychain/Touch ID)
- headless delegation system — web-approved root delegation stored at `~/.pragma/delegations/root/delegation.json`
- session key generation and storage with `0o600` file permissions
- tool blocklist for macOS-only tools (`create_root_delegation`, `nadfun_create`)
- skills: `pragma-core` (trading, market intelligence, wallet management), `pragma-autonomous` (background agent mode)
- agents: `kairos` (perpetuals), `thymos` (memecoins), `pragma` (general-purpose)
- 40+ MCP tools: wallet, swaps, transfers, wrapping, LeverUp perps, nad.fun memecoins, market data, sub-agent management
