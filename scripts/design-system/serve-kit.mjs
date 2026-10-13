import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitDirectory = process.env.UI_KIT_ROOT ?? fileURLToPath(new URL('../../storybook-static/', import.meta.url));
const root = await realpath(kitDirectory).catch(() => {
  console.error('Build the kit first: node_modules/.bin/storybook build');
  process.exit(1);
});
const port = Number(process.env.UI_KIT_PORT ?? 6010);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid UI_KIT_PORT');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = await realpath(resolve(root, `.${pathname}`));
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    let info = await stat(path);
    if (info.isDirectory()) {
      path = await realpath(resolve(path, 'index.html'));
      if (!path.startsWith(root + sep)) throw new Error('Outside preview root');
      info = await stat(path);
    }
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else
      createReadStream(path)
        .on('error', () => response.destroy())
        .pipe(response);
  } catch {
    response.writeHead(404).end('Preview file not found');
  }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen({ host: '127.0.0.1', port, backlog: 128 }, () => {
  console.log(`Geul design system: http://localhost:${port}/`);
});
