import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readFileSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUBLIC_ORIGIN = 'https://anastasiay.ipv64.net';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const style = readFileSync(new URL('./home-ui.css', import.meta.url), 'utf8') + readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const themeScript = readFileSync(new URL('./theme-script.txt', import.meta.url), 'utf8');
const themeControl = '<label class="theme-control"><span>外观</span><select data-theme-picker aria-label="外观"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>';
function page(title, content, home = false) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f5f7"><script>${themeScript}</script><title>${escape(title)} · 娜斯佳私人俄语课堂</title><style>${style}</style></head><body>${home ? content : `<main class="fallback"><div class="theme-toolbar">${themeControl}</div><img class="fallback-avatar" src="/public/teacher-cartoon-v1.png" alt="老师的漫画头像" width="144" height="144">${content}<footer>娜斯佳私人俄语课堂 · Анастасия Янукович</footer></main>`}</body></html>`;
}
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({notes:'<path d="M7 3h10a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M4 17h15M9 7h6M9 11h4"/>',book:'<path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Zm0 0v14"/>',audio:'<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v6h4v-6Zm16 0h1v6h-4v-6Z"/>',shield:'<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'})[name]}</svg>`;
export function renderHome(manifest, email) {
  const titles = ['课堂笔记', '俄语入门 · 第 1–36 页', '俄语入门 · 第 37–72 页', '俄语入门 · 第 73–108 页'];
  const descriptions = ['从字母与发音开始，轻松复习课堂里的每一个新词。', '发音、字母与初次问候。让第一句俄语，自然说出口。', '沿着课本继续前进，在词语和对话中慢慢积累。', '把学过的词连成句子，继续拓展你的俄语世界。'];
  const ranges = ['106 个词语 · 15 个主题', '第 1–36 页', '第 37–72 页', '第 73–108 页'];
  const links = Object.keys(manifest).map((name, i) => `<a class="course-tile ${i === 0 ? 'featured' : ''}" href="${encodeURI(name)}"><div class="tile-top"><span class="course-icon">${icon(i === 0 ? 'notes' : 'book')}</span><span class="tile-meta">${escape(ranges[i] || '')}</span></div><h3>${escape(titles[i] || name)}</h3><p>${escape(descriptions[i] || '打开课程，开始学习。')}</p><div class="tile-bottom"><span>${i === 0 ? '复习课堂笔记' : '打开点读教材'}</span><span class="tile-arrow" aria-hidden="true">↗</span></div></a>`).join('');
  return page('我的课堂', `<nav class="site-nav" aria-label="主导航"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">АЯ</span>私人俄语课堂</a><div class="account"><span>已登录：${escape(email)}</span>${themeControl}<form action="/logout" method="post"><button type="submit">退出登录</button></form></div></nav><main class="home-shell"><section class="hero"><div><div class="kicker">РУССКИЙ ЯЗЫК · 我的学习空间</div><h1>今天，也学一点俄语。</h1><p>听见一个新词，说出一句问候。<br>从这里开始，按自己的节奏慢慢来。</p></div><div class="teacher"><img class="teacher-portrait" src="/public/teacher-cartoon-v1.png" alt="老师的漫画头像" width="160" height="160"><div><strong lang="ru">Анастасия Янукович</strong><span>你的俄语老师</span></div></div></section><section aria-labelledby="my-courses"><div class="section-heading"><h2 id="my-courses">我的课程</h2><span>一点一滴，都会成为进步。</span></div><nav class="course-grid" aria-label="课程目录">${links}</nav></section><div class="feature-badges"><span>${icon('audio')}内置俄语点读</span><span>${icon('check')}按自己的节奏学习</span><span>${icon('shield')}专属私人课堂</span></div><p class="download-note">点读教材首次打开约需下载 20 MB，建议使用 Wi-Fi。学习进度保存在当前浏览器。</p><footer><span>私人俄语课堂</span><span lang="ru">Русский язык</span></footer></main><nav class="classroom-pagination" aria-label="翻页导航"><a class="classroom-next" aria-disabled="true" aria-label="上一页"><span aria-hidden="true">←</span><span>上一页</span></a><a class="classroom-next" href="/course.html" aria-label="下一页"><span>下一页</span><span aria-hidden="true">→</span></a></nav>`, true);
}
function equal(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function createApp(options = {}) {
  const config = options.auth ?? JSON.parse(process.env.ACCESS_CONFIG || '{}');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.issuer || '') ||
      typeof config.audience !== 'string' || config.audience.length < 20 ||
      !/^[A-Za-z0-9_-]{43,256}$/.test(config.originKey || '')) {
    throw new Error('ACCESS_CONFIG must contain the Access issuer, application audience and origin key.');
  }
  const contentDir = options.contentDir ?? process.env.CONTENT_DIR ?? fileURLToPath(new URL('../.deploy/content/', import.meta.url));
  const manifest = options.manifest ?? JSON.parse(readFileSync(process.env.MANIFEST_PATH ?? new URL('../.deploy/manifest.json', import.meta.url), 'utf8'));
  // This one illustration is intentionally public so the Access login page
  // can show it before authentication. No directory or user files are exposed.
  const avatar = options.avatar ?? readFileSync(process.env.CONTENT_DIR
    ? path.join(path.dirname(contentDir), 'assets/teacher-cartoon.png')
    : new URL('../assets/teacher-cartoon.png', import.meta.url));
  const now = options.now ?? (() => Date.now());
  const keys = options.keyResolver ?? createRemoteJWKSet(new URL(config.issuer + '/cdn-cgi/access/certs'), { timeoutDuration: 5000, cacheMaxAge: 600000, cooldownDuration: 30000 });
  function send(req, res, status, text, type = 'text/html; charset=utf-8') {
    res.statusCode = status; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', Buffer.byteLength(text)); res.end(req.method === 'HEAD' ? undefined : text);
  }
  function redirect(res, target) { res.writeHead(303, { Location: target, 'Cache-Control': 'no-store' }); res.end(); }
  const denied = message => page('需要邮箱验证', `<h1>需要邮箱验证</h1><p>${escape(message)}</p><p><a href="${PUBLIC_ORIGIN}/">从正式网址登录课堂 →</a></p>`);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Vary', 'Cookie, Accept-Encoding');
    try {
      const url = new URL(req.url, PUBLIC_ORIGIN);
      let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { return send(req, res, 400, 'Invalid path', 'text/plain'); }
      if (pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) return send(req, res, 200, 'ok', 'text/plain');
      if (pathname === '/public/teacher-cartoon-v1.png' && ['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', avatar.length);
        return res.end(req.method === 'HEAD' ? undefined : avatar);
      }
      const originKey = req.headers['x-reader-origin-key'];
      const assertion = req.headers['cf-access-jwt-assertion'];
      if (typeof originKey !== 'string' || !equal(originKey, config.originKey) || typeof assertion !== 'string' || assertion.length > 16000) {
        return send(req, res, 403, denied('请使用正式网址，通过白名单邮箱验证码登录。'));
      }
      let identity;
      try {
        const result = await jwtVerify(assertion, keys, {
          issuer: config.issuer, audience: config.audience, algorithms: ['RS256'],
          requiredClaims: ['exp', 'iat', 'sub', 'email'], clockTolerance: 30,
          maxTokenAge: '25h', currentDate: new Date(now()),
        });
        identity = result.payload;
        if (identity.type !== 'app' || typeof identity.email !== 'string' || identity.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) throw new Error('Not a user session');
      } catch {
        return send(req, res, 401, denied('登录会话无效或已过期，请重新进行邮箱验证。'));
      }
      if (pathname === '/logout' && req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== PUBLIC_ORIGIN) return send(req, res, 403, 'Forbidden', 'text/plain');
        res.setHeader('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
        return redirect(res, PUBLIC_ORIGIN + '/cdn-cgi/access/logout');
      }
      if (pathname === '/login' && req.method === 'POST') return send(req, res, 410, denied('共用密码登录已停用，请使用邮箱验证码。'));
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(req, res, 405, 'Method not allowed', 'text/plain'); }
      if (pathname === '/login') return redirect(res, '/');
      // The origin key and signed Access identity are checked before every
      // protected response, including conditional requests and unknown paths.
      if (pathname === '/' || pathname === '/index.html') {
        return send(req, res, 200, renderHome(manifest, identity.email));
      }
      const entry = Object.hasOwn(manifest, pathname) ? manifest[pathname] : null;
      if (!entry) return send(req, res, 404, page('页面不存在', '<h1>页面不存在</h1><p><a href="/">返回课程目录</a></p>'));
      const gzip = /(?:^|,)\s*gzip\s*(?:;q=(?!0(?:\.0*)?\s*(?:,|$))\d(?:\.\d+)?)?\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '');
      res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
      res.setHeader('ETag', 'W/' + entry.etag); res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if ((req.headers['if-none-match'] || '').split(/\s*,\s*/).includes('W/' + entry.etag)) { res.writeHead(304); return res.end(); }
      res.setHeader('Content-Length', gzip ? entry.gzipSize : entry.size);
      if (gzip) res.setHeader('Content-Encoding', 'gzip');
      if (req.method === 'HEAD') { res.writeHead(200); return res.end(); }
      const file = createReadStream(path.join(contentDir, entry.file));
      if (gzip) await pipeline(file, res); else await pipeline(file, createGunzip(), res);
    } catch {
      if (res.headersSent || res.destroyed) return res.destroy();
      send(req, res, 500, '暂时无法打开页面，请稍后重试。', 'text/plain; charset=utf-8');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Russian classroom is ready.'));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
