// Free Cloudflare front door. Course files and authentication stay on Cloud Run.
// Stream responses so the large, precompressed textbooks are never buffered here.
export default {
  async fetch(request, env, ctx) {
    if (!env?.ORIGIN_AUTH_KEY || !env?.ACCESS_AUD || !ctx?.access || ctx.access.aud !== env.ACCESS_AUD ||
        !request.headers.get('Cf-Access-Jwt-Assertion')) {
      return new Response('请先使用白名单邮箱验证身份。', {
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const source = new URL(request.url);
    const upstream = new URL('https://russian-reader-103843597903.europe-west1.run.app');
    upstream.pathname = source.pathname;
    upstream.search = source.search;
    const proxied = new Request(upstream, request);
    proxied.headers.set('X-Forwarded-Host', source.host);
    // Overwrite any client-supplied value. Only this Worker holds the origin key.
    proxied.headers.set('X-Reader-Origin-Key', env.ORIGIN_AUTH_KEY);
    try {
      const response = await fetch(proxied, {
        redirect: 'manual',
        cache: 'no-store',
      });
      const headers = new Headers(response.headers);
      const course = source.pathname.endsWith('.html') && [200, 304].includes(response.status);
      headers.set('Cache-Control', course ? 'private, no-cache, must-revalidate' : 'no-store');
      headers.set('CDN-Cache-Control', 'no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response('网站暂时无法连接，请稍后重试。', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  },
};
