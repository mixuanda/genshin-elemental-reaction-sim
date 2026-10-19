import { expect, test } from '@playwright/test';

for (const entry of ['team', 'single'] as const) for (const stage of ['load-manifest', 'load-wasm'] as const) {
  test(`${entry}: ${stage} failure terminates and retry preserves the original input`, async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.addInitScript(() => {
      const captured: unknown[] = [];
      Object.defineProperty(window, '__workerRequests', { value: captured });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        override postMessage(message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
          if (message && typeof message === "object" && "config" in message && typeof message.config === "string") captured.push(structuredClone(message));
          if (Array.isArray(transfer)) super.postMessage(message, transfer);
          else super.postMessage(message, transfer);
        }
      };
    });
    const file = stage === 'load-manifest' ? 'manifest.json' : 'source-host.wasm';
    const injectFailure = () => page.route(`**/source-host/${file}`, route => route.fulfill({ status: 503, body: 'synthetic failure' }));
    await page.goto(entry === 'team' ? '/source-simulation' : '/calculator');
    if (entry === 'single') {
      await page.locator('[data-action="source-single-skill"]').click();
      await expect(page.locator('[data-single-character] option[value="kaeya"]')).toBeAttached();
      await page.locator('[data-single-character]').selectOption('kaeya');
      await page.locator('[data-single-seed]').fill('12345');
      await injectFailure();
      await page.locator('[data-single-run]').click();
    } else {
      await page.locator('#source-host-config').evaluate(el => {
        let details = el.closest('details');
        while (details) { details.open = true; details = details.parentElement?.closest('details') ?? null; }
      });
      await page.locator('#source-host-config').fill('options iteration=1 duration=2;\nkaeya char lvl=90/90 cons=0 talent=1,1,1;\nkaeya add weapon="coolsteel" refine=1 lvl=90/90;\ntarget lvl=90 resist=0.1;\nactive kaeya;\nkaeya skill;\nwait(120);');
      await page.locator('#source-host-seed').fill('12345');
      await injectFailure();
      await page.locator('#source-host-run').click();
    }
    const diagnostic = page.locator(entry === 'team' ? '#source-host-worker-diagnostic' : '[data-single-diagnostic]');
    await expect(diagnostic).toBeVisible({ timeout: 30_000 });
    await expect(diagnostic.locator('pre')).toContainText(stage);
    const receipt = JSON.parse(await diagnostic.locator('pre').textContent() ?? '{}');
    expect(receipt.input.seed).toBe('12345');
    expect(receipt.input.configSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.input.config).toBeUndefined();
    expect(receipt.privacy.rawConfigIncluded).toBe(false);
    await expect(diagnostic.locator('details')).not.toHaveAttribute('open', '');
    const seed = page.locator(entry === 'team' ? '#source-host-seed' : '[data-single-seed]');
    await seed.fill('999');
    await page.locator(entry === 'team' ? '#source-host-diagnostic-retry' : '[data-single-retry]').click();
    await expect(diagnostic).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __workerRequests: unknown[] }).__workerRequests.length)).toBe(2);
    expect(await page.evaluate(() => {
      const requests = (window as unknown as { __workerRequests: unknown[] }).__workerRequests;
      return JSON.stringify(requests[0]) === JSON.stringify(requests[1]);
    })).toBe(true);
    await expect(page.locator(entry === 'team' ? '#source-host-run' : '[data-single-run]')).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
}
