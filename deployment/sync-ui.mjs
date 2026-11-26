import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL('../', import.meta.url);
const files = ['course.html', '俄语入门_第1-36页_俄英对照_男声点读.html', '俄语入门_第37-72页_俄英对照_男声点读.html', '俄语入门_第73-108页_俄英对照_男声点读.html'];
const css = await readFile(new URL('./apple-ui.css', import.meta.url), 'utf8');
const themeCss = await readFile(new URL('./theme.css', import.meta.url), 'utf8');
const themeScript = await readFile(new URL('./theme-script.txt', import.meta.url), 'utf8');
const pronunciationScript = await readFile(new URL('./pronunciation-script.txt', import.meta.url), 'utf8');
const themeControl = '<label class="theme-control"><span>外观</span><select data-theme-picker aria-label="外观"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>';
const avatar = (await readFile(new URL('../assets/teacher-cartoon.png', import.meta.url))).toString('base64');
const script = `<script id="classroom-ui-script">(() => {
 const toggle = document.querySelector('.tools-toggle');
 const sidebar = document.querySelector('.layout > aside');
 if (!toggle || !sidebar) return;
 toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? '收起工具' : '学习工具';
  sidebar.classList.toggle('tools-open', open);
 });
})();</script>`;
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [fileIndex, name] of files.entries()) {
 let html = await readFile(new URL(name, root), 'utf8');
 // Preserve all embedded course data, sound and images byte for byte.
 const data = html.match(/<script[^>]+id=["']book-data["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
 if (!data) throw new Error('Missing course data: ' + name);
 const before = hash(data);
 html = html.replace(/<style id="apple-ui-style">[\s\S]*?<\/style>/g, '').replace(/<script id="classroom-ui-script">[\s\S]*?<\/script>/g, '');
 html = html.replace(/<meta name="theme-color" content="#f5f5f7">/g, '');
 html = html.replace(/<style id="theme-style">[\s\S]*?<\/style>/g, '').replace(/<script id="theme-script">[\s\S]*?<\/script>/g, '').replace(/<label class="theme-control">[\s\S]*?<\/label>/g, '');
 html = html.replace('<meta name="viewport"', `<meta name="theme-color" content="#f5f5f7"><script id="theme-script">${themeScript}</script><meta name="viewport"`);
 html = html.replace('</head>', `<style id="apple-ui-style">${css}</style><style id="theme-style">${themeCss}</style></head>`);
 if (!html.includes('class="classroom-nav"')) {
  html = html.replace('<body>', '<body><nav class="classroom-nav" aria-label="课堂导航"><a href="/">‹ <span>我的课堂</span></a><span class="nav-caption" lang="ru">Анастасия Янукович · Русский язык</span><button class="tools-toggle" type="button" aria-expanded="false" aria-controls="study-sidebar">学习工具</button></nav>');
 }
 html = html.replace('<aside>', '<aside id="study-sidebar">');
 html = html.replace('<button class="tools-toggle"', themeControl + '<button class="tools-toggle"');
 html = html.replace(/<div class="teacher-label">[\s\S]*?<\/div><\/section>/, '<div class="teacher-label">俄语老师<span class="teacher-name" lang="ru">Анастасия Янукович</span><span>私人俄语课堂</span></div></section>');
 html = html.replace(/<img class="teacher-avatar"[^>]*>/, `<img class="teacher-avatar" src="data:image/png;base64,${avatar}" alt="老师的漫画头像" width="160" height="160">`);
 const teacher = html.match(/<section class="card teacher-card"[^>]*>[\s\S]*?<\/section>/)?.[0];
 if (teacher) {
  html = html.replace(teacher, '');
  html = html.replace(/<\/div><span class="badge">([\s\S]*?)<\/span><\/header>/, `<span class="badge">$1</span></div>${teacher.replace('class="card teacher-card"', 'class="header-teacher"')}</header>`);
 }
 html = html.replace('Анастасия Янукович · Русский язык', 'Русский язык').replace('course · 娜斯佳 老师 · 俄语课堂笔记', '俄语课堂笔记');
 html = html.replace('<h1>course · 俄语课堂笔记</h1>', '<h1>课堂笔记</h1>');
 const previousFile = files[fileIndex - 1];
 const previousHref = previousFile ? '/' + encodeURIComponent(previousFile) + '#last-page' : '/';
 const nextFile = files[fileIndex + 1];
 const nextHref = nextFile ? '/' + encodeURIComponent(nextFile) : '/';
 const nextLabel = nextFile ? '下一页' : '返回目录';
 html = html.replace(/<nav id="classroom-pagination"[\s\S]*?<\/nav>/g, '');
 html = html.replace(/<a id="classroom-next"[\s\S]*?<\/a>/g, '').replace(/<script id="classroom-next-script">[\s\S]*?<\/script>/g, '');
 const nextControl = `<nav id="classroom-pagination" class="classroom-pagination" aria-label="翻页导航"><a id="classroom-prev" class="classroom-next" href="${previousHref}" aria-label="上一页"><span aria-hidden="true">←</span><span>上一页</span></a><a id="classroom-next" class="classroom-next" href="${nextHref}" aria-label="${nextLabel}"><span>${nextLabel}</span><span aria-hidden="true">→</span></a></nav><script id="classroom-next-script">(() => {
  const link = document.getElementById('classroom-next');
  const next = document.getElementById('next');
  const previous = document.getElementById('prev');
  const previousLink = document.getElementById('classroom-prev');
  previousLink.addEventListener('click', event => {
   if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
   if (previous && !previous.disabled) {
    event.preventDefault();
    previous.click();
    document.getElementById('page-title')?.scrollIntoView({block:'start'});
   }
  });
  if (location.hash === '#last-page') document.getElementById('pages')?.lastElementChild?.click();
  const update = () => {
   const label = next && !next.disabled ? '下一页' : ${JSON.stringify(nextLabel)};
   link.querySelector('span').textContent = label;
   link.setAttribute('aria-label', label);
  };
  link.addEventListener('click', event => {
   if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
   if (next && !next.disabled) {
    event.preventDefault();
    next.click();
    document.getElementById('page-title')?.scrollIntoView({block:'start'});
   }
  });
  if (next) new MutationObserver(update).observe(next, {attributes:true,attributeFilter:['disabled']});
  update();
 })();</script>`;
 if (fileIndex > 0) {
  html = html.replace(/<script id="reader-pronunciation">[\s\S]*?<\/script>\n?/g, '');
  html = html.replace(/<script>(?=\s*'use strict';\s*const book=)/, opening =>
   '<script id="reader-pronunciation">' + pronunciationScript + '</script>\n' + opening);
  if (!html.includes('id="reader-pronunciation"')) throw new Error('Missing reader script: ' + name);
 }
 html = html.replace('</body>', script + nextControl + '</body>');
 const after = html.match(/<script[^>]+id=["']book-data["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
 if (hash(after) !== before) throw new Error('Course data changed: ' + name);
 for (let attempt = 0; ; attempt++) {
  try { await writeFile(new URL(name, root), html); break; }
  catch (error) {
   if (attempt >= 3 || !['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
   await delay(500 * (attempt + 1));
  }
 }
 console.log('Updated visual layer; course data preserved: ' + name);
}
