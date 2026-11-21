// Safe wrappers around localStorage. Storage can be blocked (private mode) or full,
// so every call is wrapped in try/catch and the app keeps working without it.
const PREFIX = 'unigenius.';

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns { ok: true } or { ok: false, full: boolean }. */
export function saveJson(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const full = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014;
    return { ok: false, full };
  }
}

export function loadString(key, fallback) {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveString(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
