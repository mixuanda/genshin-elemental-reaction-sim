// Node's native ESM loader requires an explicit type for JSON. TypeScript source
// is also consumed by Playwright; preserve the same JSON semantics as Vite.
export async function load(url, context, nextLoad) {
  if (new URL(url).pathname.endsWith('.json')) {
    return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  }
  return nextLoad(url, context);
}
