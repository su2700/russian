import welcome from './welcome.html';
import themeCss from './theme.css';
import themeScript from './theme-script.txt';
const avatar = 'https://russian-reader-103843597903.europe-west1.run.app/public/teacher-cartoon-v1.png';
const headers = {
 'X-Content-Type-Options': 'nosniff',
 'X-Frame-Options': 'DENY',
 'Referrer-Policy': 'no-referrer',
 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
export default {
 async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if (url.pathname === '/theme.js' || url.pathname === '/theme.css') {
   const js = url.pathname === '/theme.js';
   return new Response(request.method === 'HEAD' ? null : js ? themeScript : themeCss, {headers:{...headers,'Content-Type':js ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8','Cache-Control':'public, max-age=300'}});
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return new Response(request.method === 'HEAD' ? null : welcome, {headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300'}});
  if (url.pathname === '/teacher.png') {
   const key = new Request(url.origin + '/teacher.png');
   let response = await caches.default.match(key);
   if (!response) {
    const source = await fetch(avatar);
    if (!source.ok || !source.headers.get('Content-Type')?.startsWith('image/png')) return new Response('Image unavailable', {status:502,headers});
    response = new Response(source.body,{headers:{...headers,'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}});
    ctx.waitUntil(caches.default.put(key, response.clone()));
   }
   return request.method === 'HEAD' ? new Response(null, response) : response;
  }
  return new Response('Not found', {status:404,headers});
 }
};
