# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
