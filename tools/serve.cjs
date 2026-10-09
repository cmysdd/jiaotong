const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const port = Number(process.env.PORT || 4173);
http.createServer((request, response) => {
  let url;
  try { url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  const relative = url === '/' ? 'index.html' : url.slice(1);
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.')) || !types[path.extname(filename)]) { response.writeHead(404).end('Not found'); return; }
  fs.readFile(filename, (error, data) => {
    if (error) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache' }).end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Quiz site: http://127.0.0.1:${port}`));
