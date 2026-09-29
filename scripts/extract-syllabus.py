"""Extract all 11,000 official HSK 1–9 rows using Poppler's pdftotext.
Usage: python3 scripts/extract-syllabus.py /path/to/official-2026-syllabus.pdf
The published PDF uses table coordinates; rotated watermark text is excluded.
"""
from pathlib import Path
import collections
import json
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    target = Path(directory) / 'syllabus.xml'
    subprocess.run(['pdftotext', '-bbox', '-f', '80', '-l', '354', sys.argv[1], str(target)], check=True)
    document = ET.parse(target)
ns = {'x':'http://www.w3.org/1999/xhtml'}
rows = []
for index, page in enumerate(document.findall('.//x:page', ns)):
    words = [{'x':float(w.get('xMin')), 'y':(float(w.get('yMin')) + float(w.get('yMax'))) / 2,
              'text':w.text or ''} for w in page.findall('x:word', ns)
             if float(w.get('yMax')) - float(w.get('yMin')) < 22]
    for word in words:
        if not (65 < word['x'] < 105 and word['text'].isdigit() and word['y'] < 785): continue
        cells = [' '.join(w['text'] for w in sorted(words, key=lambda w:w['x'])
                          if left <= w['x'] < right and abs(w['y'] - word['y']) < 4)
                 for left, right in [(120,205), (205,310), (310,435), (435,590)]]
        if cells[0] and cells[0][0] in '1234567':
            rows.append(dict(number=int(word['text']), level=int(cells[0][0]), hanzi=cells[1],
                             pinyin=cells[2], pos=cells[3], page=index+80))
assert [r['number'] for r in rows] == list(range(1, 11001)), 'Missing or repeated official rows'
assert [sum(r['level'] == n for r in rows) for n in range(1,8)] == [300,200,500,1000,1600,1800,5600]
assert all(r['hanzi'] and r['pinyin'] for r in rows)
(ROOT / 'sources/hsk-2026.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print('Verified and extracted all 11,000 official rows.')
