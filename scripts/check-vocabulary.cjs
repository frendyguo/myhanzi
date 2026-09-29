const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'sources/hsk-2026.json'), 'utf8'));
const words = vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8') + '\nVOCAB');
const counts = [300, 200, 500, 1000, 1600, 1800, 5600];
assert.equal(words.length, 11000);
assert.equal(new Set(words.map(w => w.id)).size, 11000);
const indexes = Array(8).fill(0);
for (const [index, word] of words.entries()) {
  const row = rows[index];
  assert.equal(row.number, index + 1);
  assert.equal(word.syllabusNumber, row.number);
  assert.equal(word.level, row.level);
  assert.equal(word.hanzi, row.hanzi.replace(/[0-9\s]/g, ''));
  assert.equal(word.pinyin, row.pinyin);
  assert.equal(word.id, `${word.level}:${++indexes[word.level]}`);
  assert(word.meaning.trim().length > 0);
}
for (let level = 1; level <= 7; level++) {
  assert.equal(indexes[level], counts[level - 1]);
  const html = fs.readFileSync(path.join(root, `vocabulary/hsk-${level}/index.html`), 'utf8');
  assert(html.includes(`<h2 id="levelTitle">${level === 7 ? "HSK 7–9" : `HSK ${level}`}</h2>`));
  assert(html.includes('src="/data.js"'));
  assert(html.includes('src="/app.js"'));
}
console.log('PASS: all 11,000 official rows, stable IDs, definitions, level counts, and seven vocabulary bands.');
