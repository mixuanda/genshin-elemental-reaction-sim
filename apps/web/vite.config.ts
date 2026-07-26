import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

interface CachedShowcase {
  data: unknown;
  fetchedAt: string;
  expiresAt: number;
}

const showcaseCache = new Map<string, CachedShowcase>();

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function enkaShowcaseProxy(): Plugin {
  const install = (middlewares: {
    use: (
      handler: (
        request: IncomingMessage,
        response: ServerResponse,
        next: () => void
      ) => void
    ) => void;
  }): void => {
    middlewares.use((request, response, next) => {
      void (async () => {
        const pathname = new URL(
          request.url ?? "/",
          "http://127.0.0.1"
        ).pathname;
        const match = pathname.match(/^\/api\/showcase\/([^/]+)$/);
        if (!match) {
          next();
          return;
        }
        const uid = decodeURIComponent(match[1] ?? "");
        if (!/^[1-9]\d{8,9}$/.test(uid)) {
          sendJson(response, 400, {
            error: "UID 必须是 9–10 位数字。"
          });
          return;
        }

        const cached = showcaseCache.get(uid);
        if (cached && cached.expiresAt > Date.now()) {
          sendJson(response, 200, {
            data: cached.data,
            fetchedAt: cached.fetchedAt,
            cache: "hit"
          });
          return;
        }

        try {
          const upstream = await fetch(
            `https://enka.network/api/uid/${uid}/`,
            {
              headers: {
                Accept: "application/json",
                "User-Agent":
                  "genshin-dps-lab/1.0 (local development showcase importer)"
              },
              signal: AbortSignal.timeout(10_000)
            }
          );
          const data = (await upstream.json()) as unknown;
          if (!upstream.ok) {
            sendJson(response, upstream.status, {
              error:
                upstream.status === 404
                  ? "未找到该 UID，或展示柜暂不可见。"
                  : upstream.status === 429
                    ? "展示柜服务限流，请稍后重试。"
                    : `展示柜服务返回 HTTP ${upstream.status}。`
            });
            return;
          }
          const fetchedAt = new Date().toISOString();
          const ttl =
            typeof data === "object" &&
            data !== null &&
            "ttl" in data &&
            typeof data.ttl === "number"
              ? Math.max(30, Math.min(300, data.ttl))
              : 60;
          showcaseCache.set(uid, {
            data,
            fetchedAt,
            expiresAt: Date.now() + ttl * 1000
          });
          sendJson(response, 200, {
            data,
            fetchedAt,
            cache: "miss"
          });
        } catch (error) {
          sendJson(response, 502, {
            error:
              error instanceof Error
                ? `展示柜服务不可用：${error.message}`
                : "展示柜服务不可用。"
          });
        }
      })();
    });
  };

  return {
    name: "enka-showcase-proxy",
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    }
  };
}

export default defineConfig({
  plugins: [enkaShowcaseProxy()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  }
});
