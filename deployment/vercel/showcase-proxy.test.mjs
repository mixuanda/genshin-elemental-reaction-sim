import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShowcaseProxy } from './showcase-proxy.mjs';

const call = async (handler, uid, method = 'GET') => {
  const headers = {};
  let body;
  const res = { statusCode: 0, setHeader: (name, value) => { headers[name] = value; }, end: text => { body = JSON.parse(text); } };
  await handler({ url: `/api/showcase?uid=${encodeURIComponent(uid)}`, method, headers: { Cookie: 'must-not-forward' } }, res);
  return { status: res.statusCode, headers, body };
};

test('rejects invalid UID and writes before making any upstream call', async () => {
  const handler = createShowcaseProxy({ transport: () => { throw Error('must not fetch'); } });
  for (const uid of ['0', 'https://example.com/', '12345678', '012345678', '12345678901']) assert.equal((await call(handler, uid)).status, 400);
  const response = await call(handler, '123456789', 'POST');
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, 'GET');
});

test('public response shape and TTL cache are retained without forwarding sessions', async () => {
  let clock = 1000, calls = 0;
  const handler = createShowcaseProxy({ now: () => clock, transport: async (url, init) => {
    calls++;
    assert.equal(url, 'https://enka.network/api/uid/123456789/');
    assert.deepEqual(Object.keys(init.headers).sort(), ['Accept', 'User-Agent']);
    assert.equal(init.redirect, 'error');
    return new Response(JSON.stringify({ ttl: 2, avatarInfoList: [] }));
  } });
  const first = await call(handler, '123456789');
  assert.equal(first.status, 200); assert.equal(first.body.cache, 'miss');
  assert.equal(first.body.fetchedAt, '1970-01-01T00:00:01.000Z');
  assert.equal(first.headers['Cache-Control'], 'no-store');
  clock = 2999; assert.equal((await call(handler, '123456789')).body.cache, 'hit');
  clock = 3000; assert.equal((await call(handler, '123456789')).body.cache, 'miss');
  assert.equal(calls, 2);
});

test('zero upstream TTL is not extended; errors are not cached', async () => {
  let calls = 0;
  const handler = createShowcaseProxy({ transport: async () => { calls++; return new Response('{"ttl":0}'); } });
  await call(handler, '123456789'); await call(handler, '123456789'); assert.equal(calls, 2);
  for (const status of [404, 429, 503]) {
    const fail = createShowcaseProxy({ transport: async () => new Response('upstream error', { status }) });
    const response = await call(fail, '123456789');
    assert.equal(response.status, status); assert.match(response.body.error, /未找到|限流|HTTP/);
  }
  const fail = createShowcaseProxy({ transport: async () => { throw Error('private upstream internals'); } });
  const response = await call(fail, '123456789');
  assert.equal(response.status, 502); assert.doesNotMatch(JSON.stringify(response), /private upstream/);
});
