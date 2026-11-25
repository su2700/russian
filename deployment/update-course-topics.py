"""Organize requested topic cards without repeating vocabulary or reading order."""
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
page = book['pages'][0]
topic = json.loads((ROOT / 'deployment/course-topics-20261124.json').read_text(encoding='utf-8'))
words = {word['s']: dict(word) for word in page['words']}
audio = dict(book['audio'])
for textbook in ROOT.glob('*.html'):
    if textbook == source:
        continue
    other = json.loads(DATA.search(textbook.read_text(encoding='utf-8'))[2])
    for key, clip in other['audio'].items():
        audio.setdefault(key, clip)
for clip in (ROOT / 'assets/course-audio').glob('*.mp3'):
    if clip.stat().st_size > 500:
        audio.setdefault(clip.stem, 'data:audio/mpeg;base64,' + base64.b64encode(clip.read_bytes()).decode())

claimed = {word if isinstance(word, str) else word['s'] for group in topic['groups'] for word in group['words']}
groups = []
for group in page['groups']:
    if group.get('lessonId') == topic['lessonId']:
        continue
    keys = [page['words'][index]['s'] for index in group['indices'] if page['words'][index]['s'] not in claimed]
    if keys:
        groups.append({key: value for key, value in group.items() if key != 'indices'} | {'keys': keys})
for group in topic['groups']:
    keys = []
    for entry in group['words']:
        key = entry if isinstance(entry, str) else entry['s']
        if isinstance(entry, dict):
            words[key] = dict(entry, t=entry['display'], x=0, y=0, w=0, h=0)
        assert key in words, 'Missing existing vocabulary: ' + key
        clip = audio.get(key) or audio.get(key.replace('ё', 'е'))
        assert clip, 'Missing pronunciation: ' + key
        book['audio'][key] = clip
        keys.append(key)
    groups.append({key: value for key, value in group.items() if key != 'words'} | {'keys': keys, 'lessonId': topic['lessonId']})
for key, patch in topic['overrides'].items():
    words[key].update(patch)

groups[3].update(title='学生称呼', intro='студе́нтка 指女大学生，是身份称呼，不是一个固定年龄阶段。年龄称呼见后面的女性、男性和通用年龄专题。')
groups[5].update(title='运动员与国籍', intro='把男性、女性形式成对记忆：спортсме́н — спортсме́нка；белору́с — белору́ска。教师称呼见后面的学校专题。')
groups[7].update(title='中性名词：имя 与 время', intro='и́мя、вре́мя 虽然以 -я 结尾，却是中性名词，用 оно。截图里的阳性词 ко́фе 和男性亲属词分别收在咖啡、家庭专题。')
ordered = [key for group in groups for key in group['keys']]
assert len(ordered) == len(set(ordered)), 'Repeated card across topic groups'
assert set(ordered) == set(words), 'Existing vocabulary must not be lost'
page['words'] = [words[key] for key in ordered]
index = {key: position for position, key in enumerate(ordered)}
for number, group in enumerate(groups, 1):
    group['title'] = f'{number} · ' + re.sub(r'^\d+ · ', '', group['title'])
    group['indices'] = [index[key] for key in group.pop('keys')]
page['groups'] = groups
for key in ordered:
    book['translations'][key] = words[key]['en']
    assert key in book['audio']
text = text[:match.start(2)] + json.dumps(book, ensure_ascii=False, separators=(',', ':')) + text[match.end(2):]
links = ''.join(f'<a href="#course-section-{i + 1}">{html.escape(group["title"])}</a>' for i, group in enumerate(groups))
text = re.sub(r'(<nav aria-label="本页目录">).*?(</nav>)', lambda m: m[1] + links + m[2], text, count=1, flags=re.S)
source.write_text(text, encoding='utf-8')
server = ROOT / 'deployment/server.mjs'
server.write_text(re.sub(r'\d+ 个词语 · \d+ 个主题', f'{len(ordered)} 个词语 · {len(groups)} 个主题', server.read_text(encoding='utf-8')), encoding='utf-8')
print(f'Updated topics: {len(ordered)} unique entries in {len(groups)} sections; reading order matches the cards.')
