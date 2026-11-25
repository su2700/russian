import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { createApp } from './server.mjs';

test('Access JWT and origin secret protect content and invalidate old password sessions', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'russian-access-'));
  const raw = Buffer.from('<!doctype html><title>Русский 中文</title><p>Привет</p>');
  const gz = gzipSync(raw); writeFileSync(path.join(dir, '0.gz'), gz);
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey); publicJwk.kid = 'test-key';
  const auth = { issuer: 'https://test-reader.cloudflareaccess.com', audience: 'a'.repeat(64), originKey: randomBytes(48).toString('base64url') };
  let time = Date.now();
  const issue = async (claims = {}, key = privateKey) => new SignJWT({
    type: 'app', email: 'lhllfc@gmail.com', iss: auth.issuer, aud: auth.audience,
    sub: 'user-123', iat: Math.floor(time / 1000), exp: Math.floor(time / 1000) + 86400, ...claims,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key);
  const app = createApp({ auth, now: () => time, keyResolver: createLocalJWKSet({ keys: [publicJwk] }), contentDir: dir,
    manifest: { '/课程.html': { file: '0.gz', size: raw.length, gzipSize: gz.length, etag: '"fixture"' } } });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = (url, options = {}) => fetch(base + url, { redirect: 'manual', ...options });
  t.after(async () => { await new Promise(resolve => app.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  assert.equal((await get('/healthz')).status, 200);
  const avatar = await get('/public/teacher-cartoon-v1.png');
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get('content-type'), 'image/png');
  assert.equal((await get('/public/teacher-cartoon-v1.png', { method: 'HEAD' })).status, 200);
  assert.equal((await get('/public/teacher-cartoon-v1.png', { method: 'POST' })).status, 403);
  for (const route of ['/public/', '/public/../course.html', '/assets/teacher-cartoon.png', '/public/teacher-reference.jpg']) {
    assert.equal((await get(route)).status, 403, 'Only the exact cartoon image may be public');
  }
  for (const route of ['/', '/课程.html', '/.git/config']) assert.equal((await get(route)).status, 403);
  assert.equal((await get('/课程.html', { headers: { 'If-None-Match': 'W/"fixture"' } })).status, 403);
  assert.equal((await get('/', { headers: { Cookie: '__session=old-signed-cookie' } })).status, 403);
  assert.equal((await get('/login', { method: 'POST', body: 'password=old-password' })).status, 403);
  const token = await issue();
  const headers = { 'X-Reader-Origin-Key': auth.originKey, 'Cf-Access-Jwt-Assertion': token };
  assert.equal((await get('/', { headers: { 'Cf-Access-Jwt-Assertion': token } })).status, 403, 'JWT alone cannot access origin directly');
  assert.equal((await get('/', { headers: { 'X-Reader-Origin-Key': auth.originKey } })).status, 403);
  assert.equal((await get('/', { headers: { ...headers, 'Cf-Access-Jwt-Assertion': token + 'x' } })).status, 401);
  const otherKeys = await generateKeyPair('RS256');
  assert.equal((await get('/', { headers: { ...headers, 'Cf-Access-Jwt-Assertion': await issue({}, otherKeys.privateKey) } })).status, 401);
  for (const overrides of [{ iss: 'https://attacker.example' }, { aud: 'another-application' }, { email: '' }, { type: 'service_auth' }]) {
    assert.equal((await get('/', { headers: { ...headers, 'Cf-Access-Jwt-Assertion': await issue(overrides) } })).status, 401);
  }
  const index = await get('/', { headers }); assert.equal(index.status, 200); assert.match(await index.text(), /lhllfc@gmail.com/);
  const course = await get('/课程.html', { headers }); assert.equal(course.status, 200); assert.equal(await course.text(), raw.toString());
  assert.equal(course.headers.get('content-encoding'), 'gzip');
  assert.equal(course.headers.get('cache-control'), 'private, no-cache, must-revalidate');
  const identity = await get('/课程.html', { headers: { ...headers, 'Accept-Encoding': 'gzip;q=0, identity' } });
  assert.equal(identity.headers.get('content-encoding'), null); assert.equal(await identity.text(), raw.toString());
  assert.equal((await get('/课程.html', { headers: { ...headers, 'If-None-Match': 'W/"fixture"' } })).status, 304);
  for (const route of ['/manifest.json', '/.git/config', '/.local/access.txt', '/content/0.gz']) assert.equal((await get(route, { headers })).status, 404);
  assert.equal((await get('/login', { method: 'POST', headers, body: 'password=old' })).status, 410);
  assert.equal((await get('/logout', { method: 'POST', headers: { ...headers, Origin: 'https://attacker.example' } })).status, 403);
  const logout = await get('/logout', { method: 'POST', headers: { ...headers, Origin: 'https://anastasiay.ipv64.net' } });
  assert.equal(logout.headers.get('location'), 'https://anastasiay.ipv64.net/cdn-cgi/access/logout');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  time += 2 * 86400000;
  assert.equal((await get('/课程.html', { headers })).status, 401);
});
