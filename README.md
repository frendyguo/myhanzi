# MyHanzi

A static Mandarin vocabulary flashcard site. No build step, server code, account, or database is required.

## Host it

Upload the **contents of this folder** to the root of any static web host. The site has these routes:

- `/` and `/study/` — study level selector and custom presets
- `/study/hsk-1/` through `/study/hsk-9/` — tests that start immediately when opened; advanced levels share the `/study/hsk-7-9/` preset
- `/vocabulary/` — HSK level directory
- `/vocabulary/hsk-7-9/` — shared official advanced list (also shown by `/hsk-7/`, `/hsk-8/`, and `/hsk-9/` under `/vocabulary/`)
- `/vocabulary/hsk-1/` through `/vocabulary/hsk-9/` — complete cumulative vocabulary for each level (URLs without the trailing slash redirect normally)

For example, with Nginx, point the document root to this folder and enable normal directory index handling. With Cloudflare Pages or Netlify, publish this folder directly (no build command). Paths in the HTML are rooted at `/`, so a deployment under a URL subpath requires changing the asset and navigation paths.

For local preview, run `python3 -m http.server 8000` in this folder and visit `http://localhost:8000/`.

## Files

- `index.html`, `study/index.html`, `vocabulary/index.html`, `vocabulary/hsk-*/index.html` — page markup
- `style.css` — styles
- `app.js` — presets, spaced review, search, colors, and animation
- `data.js` — all 11,000 official 2026 HSK entries through level 9, with pinyin and dictionary definitions
- `sources/` — official row extract, source details, and dictionary license attribution
- `scripts/` — reproducible data/page builders and vocabulary validation

The seven built-in Study presets and vocabulary pages are cumulative: HSK 1 has 300 entries; HSK 2 has 500; HSK 3 has 1,000; HSK 4 has 2,000; HSK 5 has 3,600; HSK 6 has 5,400; the shared HSK 7–9 band has 11,000. The official syllabus does not assign separate vocabulary lists to levels 7, 8, and 9. Custom presets can combine the new vocabulary introduced at any of levels 1–6 or the shared 7–9 band. Separate readings/senses in the official syllabus remain separate entries.

Progress and presets are saved in the visitor's browser `localStorage` under `myhanzi-v2`. They do not sync between devices. Older presets named exactly for an HSK level are upgraded to the complete cumulative list and consolidated with duplicate built-ins. Original records are retained in `archivedPresets` in exported backups; for conflicting word histories the record with more review attempts is used, without adding overlapping counts. Use **Export backup** on the Study page to keep a copy and **Import backup** on another device.

Stroke animation loads Hanzi Writer 3.5 and character stroke data from jsDelivr. It is optional during Study and automatic in vocabulary popups. The rest of the site works without this external service; the plain word is shown if animation cannot load. Hanzi Writer is MIT licensed: https://github.com/chanind/hanzi-writer . Its character data has a separate Arphic Public License, documented in that repository.

Words, levels, and pinyin come from the official syllabus linked at https://www.chinesetest.cn/syllabus. English definitions are adapted from CC-CEDICT under CC BY-SA 4.0; they may include senses beyond those required by the syllabus. See [source and license details](sources/README.md).

After editing either the Study or Vocabulary page template, run `python3 scripts/build-pages.py` to regenerate the static level pages. Run `node scripts/check-vocabulary.cjs` to validate complete coverage and stable IDs. No build step is needed to serve the checked-in site.

Selecting a Study tile updates the sidebar in place. Start Test opens the selected built-in level’s study URL and begins a fresh test using the saved card count.
