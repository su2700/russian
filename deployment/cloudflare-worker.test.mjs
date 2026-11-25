import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './cloudflare-worker.mjs';

test('proxy pins the origin and streams authenticated responses without caching', async t => {
  const original = globalThis.fetch;
  const env = { ORIGIN_AUTH_KEY: 'test-origin-key', ACCESS_AUD: 'test-application' };
  const ctx = { access: { aud: env.ACCESS_AUD } };
  const authHeaders = { 'Cf-Access-Jwt-Assertion': 'test-assertion' };
  for (const bad of [{}, { access: { aud: 'other' } }]) {
    assert.equal((await worker.fetch(new Request('https://anastasiay.ipv64.net/'), env, bad)).status, 403);
  }
  assert.equal((await worker.fetch(new Request('https://anastasiay.ipv64.net/'), env, ctx)).status, 403);
  t.after(() => { globalThis.fetch = original; });
  for (const path of ['/course.html?test=1', '//attacker.example/steal', '/%E4%BF%84%E8%AF%AD.html']) {
    let captured;
    const response = new Response('protected', { headers: { 'Cache-Control': 'private, no-cache', 'Set-Cookie': '__session=test; Secure; HttpOnly' } });
    globalThis.fetch = async (request, options) => { captured = { request, options }; return response; };
    const result = await worker.fetch(new Request('https://anastasiay.ipv64.net' + path, { headers: { ...authHeaders, Cookie: 'CF_Authorization=test', 'X-Reader-Origin-Key': 'attacker-supplied' } }), env, ctx);
    assert.equal(result.body, response.body, 'pass the original stream through without buffering');
    assert.equal(result.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(result.headers.get('Cache-Control'), path === '//attacker.example/steal' ? 'no-store' : 'private, no-cache, must-revalidate');
    assert.equal(new URL(captured.request.url).host, 'russian-reader-103843597903.europe-west1.run.app');
    assert.equal(captured.request.headers.get('Cookie'), 'CF_Authorization=test');
    assert.equal(captured.request.headers.get('X-Reader-Origin-Key'), env.ORIGIN_AUTH_KEY);
    assert.equal(captured.request.headers.get('X-Forwarded-Host'), 'anastasiay.ipv64.net');
    assert.equal(captured.options.redirect, 'manual');
    assert.equal(captured.options.cache, 'no-store');
  }
  let body;
  globalThis.fetch = async request => { body = await request.text(); return new Response(null, { status: 303, headers: { Location: '/' } }); };
  const posted = await worker.fetch(new Request('https://anastasiay.ipv64.net/login', { method: 'POST', headers: authHeaders, body: 'example=body' }), env, ctx);
  assert.equal(body, 'example=body'); assert.equal(posted.status, 303);
  globalThis.fetch = async () => { throw new Error('unavailable'); };
  const failed = await worker.fetch(new Request('https://anastasiay.ipv64.net/', { headers: authHeaders }), env, ctx);
  assert.equal(failed.status, 502); assert.equal(failed.headers.get('Cache-Control'), 'no-store');
});
