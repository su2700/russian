"""Merge the supplied classroom notes and gender-table vocabulary once.

Reuses the textbooks' existing Russian male recordings; four missing words
have dedicated DmitryNeural clips in assets/course-audio.
"""
import base64
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
DATA = re.compile(r'(<script[^>]*id=["\']book-data["\'][^>]*>)(.*?)(</script>)', re.S)
source = ROOT / 'course.html'
text = source.read_text(encoding='utf-8')
match = DATA.search(text)
book = json.loads(match[2])
lesson = json.loads((ROOT / 'deployment/course-additions-20261124.json').read_text(encoding='utf-8'))
audio = dict(book['audio'])
for textbook in ROOT.glob('*.html'):
    if textbook == source:
        continue
    other = json.loads(DATA.search(textbook.read_text(encoding='utf-8'))[2])
    for key, clip in other['audio'].items():
        audio.setdefault(key, clip)
for clip in (ROOT / 'assets/course-audio').glob('*.mp3'):
    assert clip.stat().st_size > 500
    audio.setdefault(clip.stem, 'data:audio/mpeg;base64,' + base64.b64encode(clip.read_bytes()).decode())

page = book['pages'][0]
by_key = {word['s']: index for index, word in enumerate(page['words'])}
page['groups'] = [group for group in page['groups'] if group.get('lessonDate') != lesson['date']]
for group in lesson['groups']:
    indices = []
    for word in group['words']:
        word = dict(word)
        key = word['s']
        assert key in audio, 'Missing pronunciation: ' + key
        word.update(t=word['display'], x=0, y=0, w=0, h=0)
        if key in by_key:
            index = by_key[key]
            page['words'][index].update(word)
        else:
            index = len(page['words'])
            by_key[key] = index
            page['words'].append(word)
        book['audio'][key] = audio[key]
        book['translations'][key] = word['en']
        indices.append(index)
    page['groups'].append({key: group[key] for key in ['title', 'intro']} | {'indices': indices, 'lessonDate': lesson['date']})
phrase = page['words'][by_key['что значит как дела']]
phrase['t'] = phrase['display'] = 'Что зна́чит «как дела́»?'
page['words'][by_key['книга']]['zh'] = '书 📚'
book['titles'][0] = '俄语课堂笔记'
keys = [word['s'] for word in page['words']]
assert len(keys) == len(set(keys))
assert set(keys) <= book['audio'].keys()
assert sorted(index for group in page['groups'] for index in group['indices']) == list(range(len(keys)))
text = text[:match.start(2)] + json.dumps(book, ensure_ascii=False, separators=(',', ':')) + text[match.end(2):]
links = ''.join(f'<a href="#course-section-{index + 1}">{html.escape(group["title"])}</a>' for index, group in enumerate(page['groups']))
text = re.sub(r'(<nav aria-label="本页目录">).*?(</nav>)', lambda m: m[1] + links + m[2], text, count=1, flags=re.S)
text = re.sub(r'<title>.*?</title>', '<title>俄语课堂笔记 · 11月22日与11月24日</title>', text, count=1)
text = re.sub(r'<span class="badge">.*?</span>', '<span class="badge">11月22日与11月24日 · 内置俄语男声</span>', text, count=1)
text = re.sub(r'<p class="footnote">.*?</p>', '<p class="footnote">11月22日与11月24日课堂记录 · 已合并重复词条，补充图片中的名词性别与姓名昵称。</p>', text, count=1)
source.write_text(text, encoding='utf-8')
server = ROOT / 'deployment/server.mjs'
server.write_text(re.sub(r'\d+ 个词语 · \d+ 个主题', f'{len(keys)} 个词语 · {len(page["groups"])} 个主题', server.read_text(encoding='utf-8')), encoding='utf-8')
print(f'Updated course: {len(keys)} entries, {len(page["groups"])} themes, complete embedded audio.')
