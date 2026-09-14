export const DEBUG = false;

export const EXTENSION_PREFIX = "gcbulk";

export const OBSERVER_DEBOUNCE_MS = 120;

export function debugLog(message: string, ...details: unknown[]): void {
  if (DEBUG) {
    console.debug(`[${EXTENSION_PREFIX}] ${message}`, ...details);
  }
}
