import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { enkaShowcaseProxy } from '../vite.config';

type Handler = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;
function harness() {
  let handler!: Handler;
  const plugin = enkaShowcaseProxy();
  (plugin.configureServer as Function)({ middlewares: { use: (value: Handler) => { handler = value; } } });
  return () => new Promise<{ status: number; headers: Record<string, string>; body: string }>(resolve => {
    const headers: Record<string, string> = {};
    const response = { statusCode: 0, setHeader: (key: string, value: string) => { headers[key] = value; }, end: (body: string) => resolve({ status: response.statusCode, headers, body }) };
    handler({ url: '/api/showcase/800000001', method: 'GET' } as IncomingMessage, response as unknown as ServerResponse, () => { throw new Error('Unexpected fallback'); });
  });
}
afterEach(() => vi.unstubAllGlobals());
describe('request-lifetime public showcase proxy', () => {
  it('does not reuse a previous UID response even within upstream ttl', async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ttl: 300, synthetic: 'first' }))).mockResolvedValueOnce(new Response(JSON.stringify({ ttl: 300, synthetic: 'second' })));
    vi.stubGlobal('fetch', transport);
    const request = harness();
    expect(JSON.parse((await request()).body).data.synthetic).toBe('first');
    const next = await request();
    expect(JSON.parse(next.body).data.synthetic).toBe('second');
    expect(next.headers['Cache-Control']).toBe('no-store');
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenCalledWith('https://enka.network/api/uid/800000001/', expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }));
  });
  it('never exposes upstream exception details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SYNTHETIC_PRIVATE_SENTINEL')));
    const response = await harness()();
    expect(response.status).toBe(502);
    expect(response.body).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
    expect(JSON.parse(response.body)).toEqual({ error: '展示柜服务不可用。' });
  });
});
