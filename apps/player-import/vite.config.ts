import { defineConfig, type Plugin } from "vite";
import { fetchEnkaUid } from "../../packages/player-import/src/adapters";

function publicShowcase(): Plugin {
  const install = (server: { middlewares: { use: (handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (!path.startsWith("/api/player-showcase/")) return next();
      const match = path.match(/^\/api\/player-showcase\/([1-9]\d{8,9})$/);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (req.method !== "GET" || !match) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, code: "invalid-input", message: "需要有效的公开 UID 请求。" })); return; }
      void fetchEnkaUid(match[1]!).then(result => { res.end(JSON.stringify(result)); }).catch(() => {
        res.statusCode = 502; res.end(JSON.stringify({ ok: false, code: "unavailable", message: "展示柜暂不可用。旧数据保持。" }));
      });
    });
  };
  return { name: "player-import-public-showcase", configureServer: install, configurePreviewServer: install };
}
export default defineConfig({ plugins: [publicShowcase()], server: { host: "127.0.0.1", port: 5184 }, preview: { host: "127.0.0.1", port: 4184 } });
