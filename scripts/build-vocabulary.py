"""Build data.js from the official row extract and a local CC-CEDICT .gz file.
Usage: python3 scripts/build-vocabulary.py /path/to/cedict.txt.gz
Dictionary definitions are adapted under CC BY-SA 4.0; see sources/README.md.
"""
import collections
import gzip
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
COUNTS = [300, 200, 500, 1000, 1600, 1800, 5600]
# Original gloss for the one official headword absent from this CC-CEDICT release.
SUPPLEMENTAL = {'精彩纷呈': 'full of varied highlights; offering one wonderful sight or performance after another'}

def plain(text):
    text = text.lower().replace('u:', 'ü').replace('v', 'ü')
    return re.sub(r'[^a-z]', '', unicodedata.normalize('NFD', text))

def accented(text):
    marks = {'a':'āáǎà', 'e':'ēéěè', 'i':'īíǐì', 'o':'ōóǒò', 'u':'ūúǔù', 'ü':'ǖǘǚǜ'}
    def syllable(match):
        base, tone = match[1].lower().replace('u:', 'ü'), int(match[2])
        if tone == 5: return base
        vowel = next((v for v in ['a','e'] if v in base), None)
        if vowel is None: vowel = 'o' if 'ou' in base else next((c for c in reversed(base) if c in marks), None)
        if vowel is None: return base
        return base.replace(vowel, marks[vowel][tone-1], 1)
    return re.sub(r'([a-zA-Zü:]+)([1-5])', syllable, text).replace(' ', '').lower()

rows = json.loads((ROOT / 'sources/hsk-2026.json').read_text())
assert [r['number'] for r in rows] == list(range(1, 11001))
assert [sum(r['level'] == n for r in rows) for n in range(1, 8)] == COUNTS
entries = collections.defaultdict(list)
with gzip.open(sys.argv[1], 'rt', encoding='utf-8') as source:
    for line in source:
        m = re.match(r'(\S+) (\S+) \[([^]]+)\] /(.+)/', line)
        if m: entries[m[2]].append({'pinyin':m[3], 'meaning':m[4]})

words = []
level_indexes = collections.Counter()
for row in rows:
    hanzi = re.sub(r'[0-9\s]', '', row['hanzi'])
    candidates = entries.get(hanzi) or (entries.get(hanzi[:-1]) if hanzi.endswith('儿') else None)
    if not candidates and hanzi in SUPPLEMENTAL:
        candidates = [{'pinyin':row['pinyin'], 'meaning':SUPPLEMENTAL[hanzi]}]
    assert candidates, f'Missing definition: {hanzi}'
    readings = row['pinyin'].split('/')
    exact = [c for c in candidates if accented(c['pinyin']) in readings]
    approximate = [c for c in candidates if any(plain(c['pinyin']) in [plain(p), plain(p).removesuffix('r')] for p in readings)]
    selected = exact or approximate or candidates
    # Prefer common vocabulary to proper names when both share the reading.
    common = [c for c in selected if not c['pinyin'][0].isupper()]
    selected = common or selected
    definitions = []
    for entry in selected:
        for definition in entry['meaning'].split('/'):
            if definition.startswith('CL:'): continue
            if definition not in definitions: definitions.append(definition)
    level_indexes[row['level']] += 1
    words.append({'hanzi':hanzi, 'pinyin':row['pinyin'], 'meaning':'; '.join(definitions),
                  'level':row['level'], 'id':f"{row['level']}:{level_indexes[row['level']]}",
                  'pos':row['pos'], 'syllabusNumber':row['number']})
assert all(w['meaning'] and w['pinyin'] for w in words)
header = '// Official 2026 HSK 1–9; definitions adapted from CC-CEDICT (CC BY-SA 4.0). See sources/README.md.\n'
(ROOT / 'data.js').write_text(header + 'const VOCAB = ' + json.dumps(words, ensure_ascii=False, indent=2) + ';\n')
print(f'Built {len(words)} entries; new entries by level: {COUNTS}')
