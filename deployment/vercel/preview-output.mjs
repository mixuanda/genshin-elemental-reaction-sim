// Local smoke server for the prepared Build Output API files; never deploys.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const [stage, port = '4188'] = process.argv.slice(2);
if (!stage) throw Error('Usage: node deployment/vercel/preview-output.mjs STAGE_DIRECTORY [PORT]');
const output = resolve(stage, '.vercel/output');
const root = join(output, 'static');
const config = JSON.parse(readFileSync(join(output, 'config.json')));
const { default: showcase } = await import(pathToFileURL(join(output, 'functions/api/showcase.func/index.mjs')));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.txt': 'text/plain', '.md': 'text/plain', '.gz': 'application/gzip' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    for (const rule of config.routes) {
      if (rule.handle === 'filesystem') {
        let candidate = resolve(root, '.' + path);
        if (!candidate.startsWith(root + '/') && candidate !== root) break;
        if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = join(candidate, 'index.html');
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          res.setHeader('Content-Type', mime[extname(candidate)] ?? 'application/octet-stream');
          createReadStream(candidate).pipe(res); return;
        }
        continue;
      }
      const match = path.match(new RegExp(rule.src));
      if (!match) continue;
      for (const [key, value] of Object.entries(rule.headers ?? {})) res.setHeader(key, value);
      if (rule.continue) continue;
      if (rule.status) { res.statusCode = rule.status; res.end(); return; }
      if (rule.dest) {
        const target = rule.dest.replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? '');
        if (target.startsWith('/api/showcase?')) { req.url = target; await showcase(req, res); return; }
        path = target;
        const file = resolve(root, '.' + path);
        if (file.startsWith(root + '/') && existsSync(file) && statSync(file).isFile()) {
          res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res); return;
        }
      }
    }
    res.statusCode = 404; res.end('Not found');
  } catch { res.statusCode = 400; res.end('Bad request'); }
}).listen(Number(port), '127.0.0.1', () => console.log(`Prepared GIDPS output: http://127.0.0.1:${port}`));
