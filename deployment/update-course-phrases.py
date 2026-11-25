"""Merge standalone classroom expressions, retaining unique ordered cards."""
import base64
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
source = ROOT / 'course.html'
text = source.read_text(encoding='utf-8')
match = re.search(r'(<script[^>]*id=["\']book-data["\'][^>]*>)(.*?)(</script>)', text, re.S)
book = json.loads(match[2])
page = book['pages'][0]
words = {word['s']: word for word in page['words']}
group_keys = [[page['words'][index]['s'] for index in group['indices']] for group in page['groups']]
for phrase in json.loads((ROOT / 'deployment/course-phrases.json').read_text(encoding='utf-8')):
    clip = ROOT / 'assets/course-audio' / phrase['audioFile']
    assert clip.stat().st_size > 500, 'Missing phrase audio'
    word = {key: value for key, value in phrase.items() if key not in ['audioFile', 'section']}
    word.update(t=word['display'], x=0, y=0, w=0, h=0)
    key = word['s']
    words[key] = word
    book['translations'][key] = word['en']
    book['audio'][key] = 'data:audio/mpeg;base64,' + base64.b64encode(clip.read_bytes()).decode()
    group_keys = [[item for item in keys if item != key] for keys in group_keys]
    group_keys[phrase['section'] - 1].append(key)
order = [key for keys in group_keys for key in keys]
assert len(order) == len(set(order)) == len(words)
page['words'] = [words[key] for key in order]
indices = {key: index for index, key in enumerate(order)}
for group, keys in zip(page['groups'], group_keys):
    group['indices'] = [indices[key] for key in keys]
text = text[:match.start(2)] + json.dumps(book, ensure_ascii=False, separators=(',', ':')) + text[match.end(2):]
source.write_text(text, encoding='utf-8')
server = ROOT / 'deployment/server.mjs'
server.write_text(re.sub(r'\d+ 个词语 · \d+ 个主题', f'{len(order)} 个词语 · {len(page["groups"])} 个主题', server.read_text(encoding='utf-8')), encoding='utf-8')
print(f'Updated classroom expressions: {len(order)} entries in {len(page["groups"])} topics.')
