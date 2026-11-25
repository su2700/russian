// Local visual review only; never included in the production image.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { renderHome } from './server.mjs';
const names = ['course.html', '俄语入门_第1-36页_俄英对照_男声点读.html', '俄语入门_第37-72页_俄英对照_男声点读.html', '俄语入门_第73-108页_俄英对照_男声点读.html'];
const manifest = Object.fromEntries(names.map(name => ['/' + name, {}]));
http.createServer((req, res) => {
 const route = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
 res.setHeader('Cache-Control', 'no-store');
 if (route === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(renderHome(manifest, '本机设计预览')); }
 if (route === '/public/teacher-cartoon-v1.png') { res.setHeader('Content-Type', 'image/png'); return createReadStream(new URL('../assets/teacher-cartoon.png', import.meta.url)).pipe(res); }
 if (Object.hasOwn(manifest, route)) {
  const file = new URL('../' + route.slice(1), import.meta.url);
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Length', statSync(file).size);
  return createReadStream(file).pipe(res);
 }
 res.writeHead(404).end();
}).listen(4173, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:4173'));
