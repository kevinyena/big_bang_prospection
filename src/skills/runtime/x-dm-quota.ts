/**
 * Persistent X DM quota tracker.
 *
 * Lives at .data/x-dm-quota.json (gitignored alongside the X tokens).
 *
 * Tracks:
 *   - sentToday          → successful DMs sent in the current UTC day
 *   - sendsTodayAt[]     → timestamps of those sends (for windowed checks)
 *   - consecutiveFails   → count of back-to-back 403s; resets on any ✓
 *   - cooldownUntil      → epoch ms ; if set, refuse to send until past this
 *   - lastDayStartedAt   → the UTC day start we're counting against
 *
 * Why server-side: the trust score throttle is account-wide, not browser-wide.
 * Multiple tabs / refreshes mustn't reset the counter — the X account's
 * "remaining DM headroom for today" is the source of truth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUOTA_PATH = path.resolve(__dirname, '..', '..', '..', '.data', 'x-dm-quota.json');

export interface XDmQuotaState {
  /** Successful DMs sent since the start of the current UTC day. */
  sentToday: number;
  /** Timestamps of recent ✓ sends, last 24h. */
  sendsTodayAt: number[];
  /** Consecutive 403/failure count. Resets on ✓. */
  consecutiveFails: number;
  /** If set, sends are blocked until past this epoch ms. */
  cooldownUntil: number | null;
  /** UTC day start we're counting against (so we know when to reset). */
  lastDayStartedAt: number;
  /** Last update for debugging. */
  updatedAt: number;
}

function utcDayStart(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function freshState(): XDmQuotaState {
  return {
    sentToday: 0,
    sendsTodayAt: [],
    consecutiveFails: 0,
    cooldownUntil: null,
    lastDayStartedAt: utcDayStart(),
    updatedAt: Date.now(),
  };
}

let cached: XDmQuotaState | null = null;

export async function loadQuota(): Promise<XDmQuotaState> {
  if (cached) return rotateIfNewDay(cached);
  try {
    const raw = await fs.readFile(QUOTA_PATH, 'utf-8');
    cached = JSON.parse(raw) as XDmQuotaState;
    return rotateIfNewDay(cached);
  } catch {
    cached = freshState();
    return cached;
  }
}

/** If the stored day is stale (we've crossed UTC midnight), reset counters. */
function rotateIfNewDay(s: XDmQuotaState): XDmQuotaState {
  const today = utcDayStart();
  if (s.lastDayStartedAt < today) {
    s.sentToday = 0;
    s.sendsTodayAt = [];
    s.lastDayStartedAt = today;
    // Don't reset consecutiveFails or cooldownUntil — those are about
    // immediate behaviour, not daily counters.
  }
  return s;
}

async function saveQuota(s: XDmQuotaState): Promise<void> {
  s.updatedAt = Date.now();
  cached = s;
  await fs.mkdir(path.dirname(QUOTA_PATH), { recursive: true });
  await fs.writeFile(QUOTA_PATH, JSON.stringify(s, null, 2), 'utf-8');
}

/**
 * Check whether we can attempt another DM. Returns { ok: true } if so;
 * { ok: false, reason } otherwise. `dailyLimit` is supplied by the caller
 * (typically from the client-side user preference).
 */
export async function checkQuotaOk(dailyLimit: number): Promise<
  | { ok: true; state: XDmQuotaState }
  | { ok: false; reason: 'cooldown' | 'daily_limit'; state: XDmQuotaState; until?: number }
> {
  const s = await loadQuota();
  if (s.cooldownUntil && s.cooldownUntil > Date.now()) {
    return { ok: false, reason: 'cooldown', state: s, until: s.cooldownUntil };
  }
  if (s.sentToday >= dailyLimit) {
    return { ok: false, reason: 'daily_limit', state: s };
  }
  return { ok: true, state: s };
}

/** Record a successful DM send. Resets the consecutive failure counter. */
export async function recordSuccess(): Promise<XDmQuotaState> {
  const s = await loadQuota();
  s.sentToday += 1;
  s.sendsTodayAt.push(Date.now());
  // Keep only last 24h
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  s.sendsTodayAt = s.sendsTodayAt.filter((t) => t >= dayAgo);
  s.consecutiveFails = 0;
  // If we recover after a cooldown, clear the cooldown.
  if (s.cooldownUntil && s.cooldownUntil <= Date.now()) s.cooldownUntil = null;
  await saveQuota(s);
  return s;
}

/**
 * Record a DM failure. If we hit `consecutiveFailsThreshold` in a row, kick
 * into a `cooldownMinutes` cooldown (stop-loss). Returns the new state +
 * whether a cooldown was triggered.
 */
export async function recordFailure(opts: {
  consecutiveFailsThreshold?: number; // default 5
  cooldownMinutes?: number; // default 60
}): Promise<{ state: XDmQuotaState; cooldownTriggered: boolean }> {
  const s = await loadQuota();
  s.consecutiveFails += 1;
  const threshold = opts.consecutiveFailsThreshold ?? 5;
  const cooldownMins = opts.cooldownMinutes ?? 60;
  let cooldownTriggered = false;
  if (s.consecutiveFails >= threshold) {
    s.cooldownUntil = Date.now() + cooldownMins * 60 * 1000;
    cooldownTriggered = true;
  }
  await saveQuota(s);
  return { state: s, cooldownTriggered };
}

/** Manual reset (admin / "I know what I'm doing" UI button). */
export async function resetQuota(): Promise<XDmQuotaState> {
  const s = freshState();
  await saveQuota(s);
  return s;
}
