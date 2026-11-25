import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './sync-ui.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.deploy');
const names = ['course.html', '俄语入门_第1-36页_俄英对照_男声点读.html', '俄语入门_第37-72页_俄英对照_男声点读.html', '俄语入门_第73-108页_俄英对照_男声点读.html'];
await mkdir(path.join(output, 'content'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(root, 'assets/teacher-cartoon.png'), path.join(output, 'assets/teacher-cartoon.png'));
const manifest = {};
for (const [index, name] of names.entries()) {
  const raw = await readFile(path.join(root, name));
  const compressed = gzipSync(raw, { level: 9 });
  const file = `${index}.html.gz`;
  manifest['/' + name] = { file, size: raw.length, gzipSize: compressed.length, etag: '"' + createHash('sha256').update(raw).digest('hex') + '"' };
  await writeFile(path.join(output, 'content', file), compressed);
  console.log(`${name}: ${(compressed.length / 1e6).toFixed(2)} MB compressed`);
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest));
await copyFile(path.join(root, 'deployment/server.mjs'), path.join(output, 'server.mjs'));
await copyFile(path.join(root, 'deployment/home-ui.css'), path.join(output, 'home-ui.css'));
await copyFile(path.join(root, 'deployment/theme.css'), path.join(output, 'theme.css'));
await copyFile(path.join(root, 'deployment/theme-script.txt'), path.join(output, 'theme-script.txt'));
await copyFile(path.join(root, 'deployment/Dockerfile'), path.join(output, 'Dockerfile'));
await copyFile(path.join(root, 'package.json'), path.join(output, 'package.json'));
await copyFile(path.join(root, 'package-lock.json'), path.join(output, 'package-lock.json'));
console.log('Deployment contains only the server and four compressed HTML documents.');
