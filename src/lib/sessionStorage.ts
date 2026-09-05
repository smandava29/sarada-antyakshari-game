const SESSION_PREFIX = 'sarada-antyakshari-session';
const HISTORY_PREFIX = 'sarada-antyakshari-history';

interface StoredSession {
  token: string;
  expiresAt: number;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function sessionKey(questionDate: string): string {
  return `${SESSION_PREFIX}:${questionDate}`;
}

function historyKey(questionDate: string): string {
  return `${HISTORY_PREFIX}:${questionDate}`;
}

function parseServerExpiry(serverExpiresAt: string): number | null {
  const expiresAt = Date.parse(serverExpiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return expiresAt;
}

function parseStoredSession(raw: string): StoredSession | null {
  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (
      typeof record.token !== 'string' ||
      record.token.length === 0 ||
      typeof record.expiresAt !== 'number' ||
      !Number.isFinite(record.expiresAt)
    ) {
      return null;
    }

    return {
      token: record.token,
      expiresAt: record.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Returns a valid game-session token.
 *
 * Expired or malformed sessions and their local attempt histories are removed
 * automatically.
 */
export function getSessionToken(questionDate: string): string | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const raw = storage.getItem(sessionKey(questionDate));

  if (!raw) {
    return null;
  }

  const session = parseStoredSession(raw);

  if (!session || Date.now() >= session.expiresAt) {
    clearSessionToken(questionDate);
    return null;
  }

  return session.token;
}

/**
 * Stores the session token using the expiration timestamp returned by the game
 * API. The client does not calculate its own expiration time.
 */
export function saveSessionToken(
  questionDate: string,
  token: string,
  serverExpiresAt: string,
): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const expiresAt = parseServerExpiry(serverExpiresAt);

  if (!token.trim() || expiresAt === null) {
    clearSessionToken(questionDate);
    return;
  }

  const session: StoredSession = {
    token,
    expiresAt,
  };

  try {
    storage.setItem(sessionKey(questionDate), JSON.stringify(session));
  } catch {
    // The current render can continue when browser storage is unavailable.
  }
}

/**
 * Synchronizes the locally stored expiration timestamp with the timestamp
 * returned by the server. This does not independently extend a server session.
 */
export function refreshSession(
  questionDate: string,
  serverExpiresAt: string,
): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const key = sessionKey(questionDate);
  const raw = storage.getItem(key);

  if (!raw) {
    return;
  }

  const session = parseStoredSession(raw);
  const expiresAt = parseServerExpiry(serverExpiresAt);

  if (!session || expiresAt === null) {
    clearSessionToken(questionDate);
    return;
  }

  const refreshedSession: StoredSession = {
    token: session.token,
    expiresAt,
  };

  try {
    storage.setItem(key, JSON.stringify(refreshedSession));
  } catch {
    // Retain the existing stored session if synchronization fails.
  }
}

/**
 * Removes a game session and its local attempt history.
 */
export function clearSessionToken(questionDate: string): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(sessionKey(questionDate));
    storage.removeItem(historyKey(questionDate));
  } catch {
    // Browser storage may be unavailable.
  }
}

/**
 * Checks whether the current game session is still valid.
 */
export function hasValidSession(questionDate: string): boolean {
  return getSessionToken(questionDate) !== null;
}

/**
 * Returns the remaining server-authorized session lifetime in milliseconds.
 */
export function getRemainingSessionTime(questionDate: string): number {
  const storage = getStorage();

  if (!storage) {
    return 0;
  }

  const raw = storage.getItem(sessionKey(questionDate));

  if (!raw) {
    return 0;
  }

  const session = parseStoredSession(raw);

  if (!session) {
    clearSessionToken(questionDate);
    return 0;
  }

  const remaining = session.expiresAt - Date.now();

  if (remaining <= 0) {
    clearSessionToken(questionDate);
    return 0;
  }

  return remaining;
}

/**
 * Loads the local attempt history for one game.
 *
 * The database remains the source of truth.
 */
export function loadAttemptHistory<T>(questionDate: string): T[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(historyKey(questionDate));

    if (!raw) {
      return [];
    }

    const value: unknown = JSON.parse(raw);

    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Saves the local attempt-history representation.
 */
export function saveAttemptHistory<T>(
  questionDate: string,
  history: T[],
): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(historyKey(questionDate), JSON.stringify(history));
  } catch {
    // Database attempt recording remains the source of truth.
  }
}

/**
 * Removes expired or malformed sessions.
 *
 * Safe to call once during application startup.
 */
export function cleanupExpiredSessions(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const now = Date.now();
  const prefix = `${SESSION_PREFIX}:`;

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);

    if (!key?.startsWith(prefix)) {
      continue;
    }

    const questionDate = key.slice(prefix.length);
    const raw = storage.getItem(key);
    const session = raw ? parseStoredSession(raw) : null;

    if (!session || session.expiresAt <= now) {
      try {
        storage.removeItem(key);
        storage.removeItem(historyKey(questionDate));
      } catch {
        // Continue checking other stored sessions.
      }
    }
  }
}