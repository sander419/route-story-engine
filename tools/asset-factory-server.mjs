import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, sep, extname } from 'node:path';

const mime = { '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json' };
export async function serve(root) {
  const server = createServer((req, res) => {
    let path;
    try { path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': (mime[extname(path)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(readFileSync(path));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => server.close(done))
  };
}
