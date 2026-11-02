export const MAX_INPUT_BYTES = 2_000_000;
// No input contents, key names, parser exceptions, URLs or HTTP bodies go into errors/logs.
const secretKey = /(?:cookie|token|authorization|password|passwd|secret|session|credential|privatekey|apikey)/i;
const secretText = /(?:\b(?:cookie|set-cookie|authorization|authentication|stoken(?:_v2)?|ltoken(?:_v2)?|ltuid|account_mid_v2|cookie_token(?:_v2)?|access_token|refresh_token|session(?:[_ -]?id)?|api[_ -]?key|password|passwd|credential|private[_ -]?key|secret|login[_ -]?ticket)\s*["']?\s*[:=]|\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b)/i;
export function containsSecrets(value: unknown): boolean {
  const queue: unknown[] = [value];
  let visited = 0;
  while (queue.length) {
    if (++visited > 100_000) return true;
    const item = queue.pop();
    if (typeof item === "string" && secretText.test(item)) return true;
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (secretKey.test(key.replace(/[^a-z0-9]/gi, ""))) return true;
        queue.push(child);
      }
    }
  }
  return false;
}
export function readInput(text: string): { ok: true; value: unknown } | { ok: false; secret: boolean } {
  if (secretText.test(text)) return { ok: false, secret: true };
  if (new TextEncoder().encode(text).length > MAX_INPUT_BYTES) return { ok: false, secret: false };
  try {
    const value: unknown = JSON.parse(text);
    return containsSecrets(value) ? { ok: false, secret: true } : { ok: true, value };
  } catch { return { ok: false, secret: false }; }
}
