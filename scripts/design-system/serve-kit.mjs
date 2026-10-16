import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmailPreviewHandler } from './email-preview-handler.mjs';

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
/**
 * Serve one immutable build; port 0 atomically reserves an independent loopback listener.
 * @param {{
 *   directory: string,
 *   port?: number,
 *   handleRequest?: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => boolean | Promise<boolean>
 * }} options
 */
export async function startKitServer({ directory, port = 0, handleRequest = undefined }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port');
  const root = await realpath(directory);
  const server = createServer(async (request, response) => {
    if (handleRequest) {
      try {
        if (await handleRequest(request, response)) return;
      } catch {
        if (!response.headersSent) response.writeHead(500);
        response.end('Preview request handler failed');
        return;
      }
    }
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
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, backlog: 128 }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const failure = new Promise((resolveFailure) => server.once('error', resolveFailure));
  return {
    url: `http://127.0.0.1:${address.port}/`,
    failure,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.UI_KIT_ROOT ?? fileURLToPath(new URL('../../storybook-static/', import.meta.url));
  const preview = await startKitServer({
    directory,
    port: Number(process.env.UI_KIT_PORT ?? 6010),
    handleRequest: createEmailPreviewHandler(),
  });
  console.log(`Geul design system: ${preview.url}`);
}
