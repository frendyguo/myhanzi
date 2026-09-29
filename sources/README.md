# Vocabulary provenance

## Official words, readings, and levels

`hsk-2026.json` contains all 11,000 numbered entries for HSK levels 1–9 from the official **HSK 考试大纲**, published November 2025, with July 2026 implementation printed on its cover. The source was accessed September 29, 2026.

- Official index: https://www.chinesetest.cn/syllabus
- Official PDF: https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf
- PDF pages 80–354 (printed pages 77–351), numbered rows 1–11000.
- PDF SHA-256: `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`

| Level | New entries | Cumulative entries |
| --- | ---: | ---: |
| 1 | 300 | 300 |
| 2 | 200 | 500 |
| 3 | 500 | 1,000 |
| 4 | 1,000 | 2,000 |
| 5 | 1,600 | 3,600 |
| 6 | 1,800 | 5,400 |
| 7–9 (shared band) | 5,600 | 11,000 |

HSK 7–9 have one shared official advanced vocabulary band, not three independently assigned word lists. Internally this band uses `level: 7`; routes for 7, 8, and 9 display that same complete set.

These are syllabus entries, including separate readings or senses of the same written word. Number suffixes in the source distinguish homonyms; the app omits those suffixes from displayed Chinese while retaining separate entries and stable IDs. The original 5,400 IDs still refer to the same Chinese entries. Official pinyin, including alternatives and tone changes, is retained.

## English definitions

English definitions are adapted from **CC-CEDICT**, the community-maintained Chinese-English dictionary published by MDBG, licensed under **Creative Commons Attribution-ShareAlike 4.0 International**:

- https://www.mdbg.net/chinese/dictionary?page=cc-cedict
- https://cc-cedict.org/wiki/
- License: https://creativecommons.org/licenses/by-sa/4.0/
- Download: https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
- Dictionary release used: 2026-09-29T08:02:51Z.
- Download SHA-256: `ac561f16bf85ec5115231e32b7f93266bf7a68ee3d63c645d5a2d427123fe03e`

The adapted dictionary definitions in `data.js` are distributed under CC BY-SA 4.0. Changes include matching simplified headwords and pronunciations, matching erhua words to base headwords where necessary, preferring common-word entries over proper names, omitting classifier metadata, deduplicating definitions, and joining senses with semicolons. The one official entry absent from this dictionary release, 精彩纷呈, uses an original supplemental English gloss in the build script. These are dictionary glosses, not official HSK translations; a gloss can include senses beyond those required at its assigned level.

## Rebuilding and verification

Download the PDF and CC-CEDICT archive separately, then run:

```sh
python3 scripts/extract-syllabus.py /path/to/official-2026-syllabus.pdf
python3 scripts/build-vocabulary.py /path/to/cedict.txt.gz
python3 scripts/build-pages.py
node scripts/check-vocabulary.cjs
```

Extraction requires Poppler's `pdftotext`. Scripts check consecutive row numbers, exact level counts, and the presence of Chinese text, pinyin, and definitions. Normal site use requires none of these tools or downloads.
