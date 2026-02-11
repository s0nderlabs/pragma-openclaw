/**
 * Session Key Manager — file-based secp256k1 key generation and storage.
 *
 * Stores the session key at ~/.pragma/session-key.json with 0600 permissions.
 * This replaces the macOS Keychain-based storage used in the CLI plugin.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";

export interface SessionKeyData {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  createdAt: number;
}

/**
 * Ensure a session key exists at the given path.
 * If it doesn't exist, generate a new secp256k1 key pair and store it.
 * Returns the session key data.
 */
export async function ensureSessionKey(path: string): Promise<SessionKeyData> {
  if (existsSync(path)) {
    return loadSessionKey(path);
  }

  // Ensure parent directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Generate new key
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const keyData: SessionKeyData = {
    privateKey,
    address: account.address,
    createdAt: Date.now(),
  };

  // Write with restrictive permissions
  writeFileSync(path, JSON.stringify(keyData, null, 2), { mode: 0o600 });

  return keyData;
}

/**
 * Load an existing session key from disk.
 */
export function loadSessionKey(path: string): SessionKeyData {
  if (!existsSync(path)) {
    throw new Error(`Session key not found at ${path}`);
  }

  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as SessionKeyData;

  if (!data.privateKey || !data.address) {
    throw new Error(`Invalid session key file at ${path}`);
  }

  return data;
}

/**
 * Update specific fields in the session key file.
 */
export function updateSessionKey(
  path: string,
  updates: Partial<SessionKeyData>
): SessionKeyData {
  const existing = loadSessionKey(path);
  const updated = { ...existing, ...updates };
  writeFileSync(path, JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}
