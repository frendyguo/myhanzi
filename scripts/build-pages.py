"""Regenerate static level pages from vocabulary/index.html (no server routing needed)."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / 'vocabulary/index.html').read_text()
for route in [str(n) for n in range(1, 10)] + ['7-9']:
    label = 'HSK 7–9' if route in ['7', '8', '9', '7-9'] else f'HSK {route}'
    html = template.replace('<title>MyHanzi · Mandarin flashcards</title>', f'<title>{label} Vocabulary · MyHanzi</title>')
    html = html.replace('<section id="vocabOverview">', '<section id="vocabOverview" class="hidden">')
    html = html.replace('id="vocabDetail" class="vocab-detail panel hidden"', 'id="vocabDetail" class="vocab-detail panel"')
    html = html.replace('<h2 id="levelTitle">HSK 1</h2>', f'<h2 id="levelTitle">{label}</h2>')
    target = ROOT / f'vocabulary/hsk-{route}/index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html)
    study = (ROOT / 'study/index.html').read_text()
    study = study.replace('<title>MyHanzi · Mandarin flashcards</title>', f'<title>{label} Study · MyHanzi</title>')
    study = study.replace('<h1>Make the words yours.</h1>', f'<a class="back-link" href="/study/">← All study levels</a><h1>{label} Study</h1>')
    study = study.replace('<h2>Choose your preset</h2>', '<h2>Your study level</h2>')
    target = ROOT / f'study/hsk-{route}/index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(study)
print('Built all HSK vocabulary pages, including shared HSK 7–9 aliases.')
