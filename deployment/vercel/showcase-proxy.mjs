// Public Enka showcase transport only. Never accepts or forwards account sessions.
export function createShowcaseProxy({ transport = fetch, now = Date.now } = {}) {
  const cache = new Map();
  return async function showcase(req, res) {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      send(405, { error: '仅支持读取公开展示柜。' });
      return;
    }
    const uid = new URL(req.url, 'http://localhost').searchParams.get('uid') ?? '';
    if (!/^[1-9]\d{8,9}$/.test(uid)) {
      send(400, { error: 'UID 必须是 9–10 位数字。' });
      return;
    }
    const previous = cache.get(uid);
    if (previous && previous.expiresAt > now()) {
      send(200, { data: previous.data, fetchedAt: previous.fetchedAt, cache: 'hit' });
      return;
    }
    try {
      const response = await transport(`https://enka.network/api/uid/${uid}/`, {
        method: 'GET', redirect: 'error',
        headers: { Accept: 'application/json', 'User-Agent': 'GIDPS/1.0 (public-showcase importer)' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        send(response.status, { error: response.status === 404 ? '未找到该 UID，或展示柜暂不可见。'
          : response.status === 429 ? '展示柜服务限流，请稍后重试。' : `展示柜服务返回 HTTP ${response.status}。` });
        return;
      }
      const data = await response.json();
      const fetchedAt = new Date(now()).toISOString();
      const ttl = typeof data?.ttl === 'number' && Number.isFinite(data.ttl)
        ? Math.max(0, Math.min(300, data.ttl)) : 60;
      if (ttl > 0) {
        if (cache.size >= 32 && !cache.has(uid)) cache.delete(cache.keys().next().value);
        cache.set(uid, { data, fetchedAt, expiresAt: now() + ttl * 1000 });
      }
      send(200, { data, fetchedAt, cache: 'miss' });
    } catch {
      // Do not log request headers, player payloads or upstream exception text.
      send(502, { error: '展示柜服务暂不可用；请保留已有配装，稍后重试。' });
    }
  };
}

export default createShowcaseProxy();
