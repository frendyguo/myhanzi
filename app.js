(() => {
  const $ = id => document.getElementById(id);
  const words = VOCAB;
  // The syllabus publishes one shared vocabulary band for HSK 7–9.
  const levels = [1, 2, 3, 4, 5, 6, 7];
  const levelLabel = level => level === 7 ? 'HSK 7–9' : `HSK ${level}`;
  const wordsById = new Map(words.map(w => [w.id, w]));
  const DAY = 86400000;
  const KEY = 'myhanzi-v2';
  const old = (() => { try { return JSON.parse(localStorage.getItem('myhanzi-v1')) || {}; } catch { return {}; } })();
  const legacyProgress = {};
  for (const w of words) {
    const p = old.progress?.[w.id] || old.progress?.[w.hanzi];
    if (p) legacyProgress[w.id] = { ...p };
  }
  const initial = { version: 3, activeId: 'starter', stroke: false, progress:legacyProgress, testNumber:0, presets: [{ id: 'starter', name: 'HSK 1', levels: (old.selected?.length ? old.selected : [1]).filter(n => levels.includes(n)) }] };
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || initial; } catch { state = initial; }
  if (!Array.isArray(state.presets) || !state.presets.length) state = initial;
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  function ensureSharedProgress() {
    if (state.version === 3 && state.progress && typeof state.progress === 'object') return false;
    const shared = state.progress && typeof state.progress === 'object' ? { ...state.progress } : {};
    const sharedTestNumber = Math.max(0, ...state.presets.map(p => p.testNumber || 0));
    const attempts = p => (p?.correct || 0) + (p?.incorrect || 0);
    for (const preset of state.presets) {
      for (const [wordId, stored] of Object.entries(preset.progress || {})) {
        if (!shared[wordId] || attempts(stored) > attempts(shared[wordId])) {
          const progress = { ...stored };
          if (progress.needsReview) {
            const remainingTests = Math.max(0, (progress.reviewAfterTest ?? preset.testNumber ?? 0) - (preset.testNumber || 0));
            progress.reviewAfterTest = sharedTestNumber + remainingTests;
          }
          shared[wordId] = progress;
        }
      }
      delete preset.progress;
      delete preset.testNumber;
    }
    state.progress = shared;
    state.testNumber = sharedTestNumber;
    state.version = 3;
    return true;
  }
  if (ensureSharedProgress()) save();
  function ensureLevelPresets() {
    const before = JSON.stringify(state);
    for (const level of levels) {
      const included = levels.filter(n => n <= level);
      const id = `hsk-2026-${level}`;
      const matches = state.presets.filter(p => p.id === id || p.builtinLevel === level ||
        (p.name.trim() === levelLabel(level) && p.levels.includes(level) && p.levels.every(n => included.includes(n))));
      const existing = matches.find(p => p.id === state.activeId) || matches[0];
      if (existing) {
        if (matches.length > 1 || existing.levels.length !== included.length) {
          // Keep duplicate preset configurations visible in exports for recovery.
          state.archivedPresets ||= [];
          for (const preset of matches) state.archivedPresets.push(JSON.parse(JSON.stringify(preset)));
        }
        for (const duplicate of matches.filter(p => p !== existing)) {
          if (state.activeId === duplicate.id) state.activeId = existing.id;
          state.presets = state.presets.filter(p => p !== duplicate);
        }
        Object.assign(existing, { name:levelLabel(level), builtinLevel:level, levels:included });
      } else state.presets.push({ id, name:levelLabel(level), builtinLevel:level, levels:included });
    }
    if (JSON.stringify(state) !== before) save();
  }
  ensureLevelPresets();
  const active = () => state.presets.find(p => p.id === state.activeId) || state.presets[0];
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
  const colorStep = (p) => {
    if (!p || !p.correct) return 0;
    const mastery = p.mastery ?? Math.min(.8, p.correct / 8) * Math.min(1, (p.streak || 0) / 5);
    return Math.max(0, Math.min(9, Math.round(9 * mastery)));
  };
  const shade = step => `color-mix(in srgb, #21985c ${Math.round(Math.pow(step / 9, 1.4) * 60)}%, white)`;
  const shuffled = items => [...items].sort(() => Math.random() - .5);
  const pool = preset => words.filter(w => preset.levels.includes(w.level));
  const page = location.pathname.startsWith('/vocabulary') ? 'vocabulary' : 'study';
  $(page === 'study' ? 'studyTab' : 'browseTab').classList.add('on');
  if (page === 'vocabulary') initVocabulary(); else initStudy();

  function loadWriter() {
    if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
      script.onload = () => window.HanziWriter ? resolve(window.HanziWriter) : reject(new Error('Hanzi Writer did not load'));
      script.onerror = () => reject(new Error('Hanzi Writer could not load'));
      document.head.appendChild(script);
    });
  }

  function levelProgress(entries, progress = {}) {
    if (!entries.length) return { reviewed:0, familiarity:0, percent:0 };
    const reviewed = entries.filter(w => (progress[w.id]?.correct || 0) + (progress[w.id]?.incorrect || 0) > 0).length;
    const familiarity = entries.reduce((sum, w) => {
      const p = progress[w.id];
      const mastery = p ? p.mastery ?? Math.min(.8, (p.correct || 0) / 8) * Math.min(1, (p.streak || 0) / 5) : 0;
      return sum + Math.max(0, Math.min(1, mastery));
    }, 0) / entries.length;
    // Coverage contributes 30%; mastery across the entire level contributes 70%.
    const percent = Math.round(1000 * (.3 * reviewed / entries.length + .7 * familiarity)) / 10;
    return { reviewed, familiarity, percent };
  }

  function initStudy() {
    document.querySelector('#test .note').textContent = 'A missed word returns at a random position in one of your next two tests.';
    const studyRoute = location.pathname.match(/^\/study\/hsk-([1-9]|7-9)(?:\/|\/index\.html)?$/);
    const studyLevel = studyRoute ? (studyRoute[1] === '7-9' ? 7 : Math.min(7, Number(studyRoute[1]))) : null;
    const cardCounts = [10, 20, 30, 40, 50, 60, 100];
    const testSize = () => cardCounts.includes(state.cardCount) ? state.cardCount : 20;
    let cards = [], index = 0, revealed = false, sessionPresetId = null, renderToken = 0;
    let writerPromise = null;
    let sessionStarted = 0, sessionResults = [], completedStats = null;
    let pendingProgress = {}, sessionActive = false;
    let historyGuardInstalled = false;
    function installHistoryGuard() {
      if (historyGuardInstalled) return;
      historyGuardInstalled = true;
      if (history.state?.hanziTestGuard) return;
      history.replaceState({ ...history.state, hanziTestGuard:false }, '', location.href);
      history.pushState({ ...history.state, hanziTestGuard:true }, '', location.href);
    }
    const unfinishedTest = () => sessionActive && sessionResults.length > 0 && index < cards.length;
    function leaveTest() {
      if (unfinishedTest() && !window.confirm('This test is unfinished. No progress from this test will be counted if you leave. Leave the test?')) return false;
      sessionActive = false;
      pendingProgress = {};
      renderToken++;
      return true;
    }
    window.addEventListener('beforeunload', e => {
      if (!unfinishedTest()) return;
      e.preventDefault();
      e.returnValue = '';
    });
    window.addEventListener('popstate', e => {
      if (!historyGuardInstalled || e.state?.hanziTestGuard) return;
      if (!leaveTest()) {
        history.pushState({ ...history.state, hanziTestGuard:true }, '', location.href);
        return;
      }
      historyGuardInstalled = false;
      if (studyLevel) history.back();
      else renderHome();
    });
    document.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || link.target === '_blank') return;
      if (!leaveTest()) e.preventDefault();
    }));
    const statsDialog = $('testStatistics');
    function showStatistics() {
      if (!completedStats) return;
      const { correct, incorrect, total, elapsed } = completedStats;
      const percent = count => `${(100 * count / total).toFixed(1)}%`;
      $('statsCorrect').textContent = `${correct} (${percent(correct)})`;
      $('statsIncorrect').textContent = `${incorrect} (${percent(incorrect)})`;
      const seconds = Math.floor(elapsed / 1000);
      $('statsElapsed').textContent = `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
      $('statsSummary').textContent = `${total} cards completed`;
      if (!statsDialog.open) statsDialog.showModal();
    }
    statsDialog.addEventListener('close', () => $('viewStats')?.focus());
    const selected = () => active();
    function renderHome() {
      document.querySelector('.nav-tabs').classList.remove('hidden');
      if (studyLevel) {
        state.activeId = state.presets.find(p => p.builtinLevel === studyLevel).id;
        save();
        document.title = `${levelLabel(studyLevel)} Study · MyHanzi`;
        $('backHome').textContent = '← Presets';
      }
      renderToken++;
      $('home').classList.remove('hidden'); $('test').classList.add('hidden');
      const characters = entries => new Set(entries.flatMap(w => [...w.hanzi].filter(c => /\p{Script=Han}/u.test(c))));
      $('presetChoices').innerHTML = state.presets.filter(p => !studyLevel || p.builtinLevel === studyLevel).map(p => {
        const entries = pool(p), level = p.builtinLevel;
        const introduced = level ? words.filter(w => w.level === level) : entries;
        const earlier = level ? characters(words.filter(w => w.level < level)) : new Set();
        const characterCount = [...characters(introduced)].filter(c => !earlier.has(c)).length;
        const detail = level === 7 ? 'Shared advanced syllabus · Includes HSK 1–6'
          : level ? (level === 1 ? 'Foundation vocabulary · 2026 syllabus' : `Complete syllabus · Includes HSK 1–${level}`)
          : `Custom preset · ${p.levels.map(levelLabel).join(' + ')}`;
        const tag = 'button';
        const attributes = `type="button" aria-pressed="${p.id === state.activeId}"`;
        return `<${tag} class="choice ${p.id === state.activeId ? 'active' : ''}" data-preset="${escape(p.id)}" ${attributes}><span class="choice-heading"><strong>${escape(p.name)}</strong><span class="choice-status">${p.id === state.activeId ? 'Selected' : 'Select preset'}</span></span><span class="choice-detail">${escape(detail)}</span><span class="choice-metrics"><span><b>${entries.length.toLocaleString()}</b><small>Total words</small></span>${level ? `<span><b>${introduced.length.toLocaleString()}</b><small>New words</small></span>` : ''}<span><b>${characterCount.toLocaleString()}</b><small>${level ? 'New characters' : 'Distinct characters'}</small></span></span></${tag}>`;
      }).join('');
      document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { state.activeId = b.dataset.preset; save(); renderHome(); });
      const p = selected(), entries = pool(p), progress = state.progress;
      const progressEntries = p.builtinLevel ? words.filter(w => w.level === p.builtinLevel) : entries;
      $('selectedTitle').textContent = p.name;
      const summary = levelProgress(progressEntries, progress);
      const progressHeading = $('studyProgressBar').previousElementSibling;
      progressHeading.innerHTML = p.builtinLevel
        ? `<a class="progress-link" href="/vocabulary/hsk-${p.builtinLevel === 7 ? '7-9' : p.builtinLevel}/">Progress <b id="studyProgressPercent">${summary.percent}%</b></a>`
        : `Progress <b id="studyProgressPercent">${summary.percent}%</b>`;
      $('studyProgressBar').value = summary.percent;
      $('studyProgressBar').textContent = `${summary.percent}%`;
      $('studyProgressDetail').textContent = `${summary.reviewed.toLocaleString()} / ${progressEntries.length.toLocaleString()} level words reviewed · ${(summary.familiarity * 100).toFixed(1)}% familiarity`;
      $('strokeToggle').checked = !!state.stroke;
      $('startTest').disabled = !entries.length;
      $('cardCountChips').innerHTML = cardCounts.map(count => `<button type="button" class="count-chip" data-card-count="${count}" aria-pressed="${count === testSize()}">${count}</button>`).join('');
    }
    function start() {
      const p = selected();
      state.cardCount = testSize();
      save();
      const entries = pool(p), progress = state.progress, now = Date.now();
      const testNumber = state.testNumber || 0;
      const missed = shuffled(entries.filter(w => progress[w.id]?.needsReview &&
        (progress[w.id].reviewAfterTest ?? testNumber) <= testNumber));
      const due = shuffled(entries.filter(w => !progress[w.id]?.needsReview && progress[w.id] && progress[w.id].due <= now));
      const fresh = shuffled(entries.filter(w => !progress[w.id]));
      const later = shuffled(entries.filter(w => progress[w.id] && !progress[w.id].needsReview && progress[w.id].due > now));
      // Reserve space for eligible missed words, then randomize their positions
      // so they do not predictably appear at the start of a test.
      cards = shuffled([...missed, ...due, ...fresh, ...later].slice(0, state.cardCount));
      sessionPresetId = p.id;
      index = 0; revealed = false;
      statsDialog.close();
      sessionStarted = performance.now(); sessionResults = []; completedStats = null;
      pendingProgress = {}; sessionActive = cards.length > 0;
      document.querySelector('.nav-tabs').classList.add('hidden');
      installHistoryGuard();
      $('home').classList.add('hidden'); $('test').classList.remove('hidden');
      renderTest();
    }
    function rate(good) {
      const w = cards[index], preset = state.presets.find(p => p.id === sessionPresetId);
      if (!w || !preset || !revealed) return;
      const old = state.progress[w.id] || { streak:0, correct:0, incorrect:0, mastery:0 };
      const streak = good ? old.streak + 1 : 0;
      const prior = old.mastery ?? Math.min(.8, old.correct / 8) * Math.min(1, old.streak / 5);
      const intervals = [0,1,3,7,14,30,60];
      pendingProgress[w.id] = { streak, correct: old.correct + Number(good), incorrect: old.incorrect + Number(!good), mastery: good ? prior + .2 * (1 - prior) : prior * .45, needsReview: !good, due: good ? Date.now() + intervals[Math.min(streak,6)] * DAY : Date.now(), reviewAfterTest: good ? undefined : (state.testNumber || 0) + 1 + Math.floor(Math.random() * 2) };
      sessionResults.push({ correct:good });
      index++; revealed = false;
      if (index === cards.length) {
        const previous = state.progress;
        const previousTestNumber = state.testNumber;
        state.progress = { ...previous, ...pendingProgress };
        state.testNumber = (state.testNumber || 0) + 1;
        try { save(); } catch {
          state.progress = previous;
          state.testNumber = previousTestNumber;
          index--; revealed = true; sessionResults.pop();
          window.alert('Your completed test could not be saved. Free up browser storage, then mark the last answer again to retry.');
          return;
        }
        pendingProgress = {}; sessionActive = false;
        const correct = sessionResults.filter(result => result.correct).length;
        completedStats = { correct, incorrect:cards.length - correct, total:cards.length,
          elapsed:performance.now() - sessionStarted };
      }
      renderTest();
      if (completedStats) showStatistics();
    }
    function renderTest() {
      renderToken++;
      const w = cards[index];
      $('strokeInTest').checked = !!state.stroke;
      $('strokeVisual').classList.add('hidden'); $('strokeVisual').replaceChildren();
      $('strokeStatus').textContent = '';
      $('word').classList.remove('hidden');
      $('counter').textContent = w ? `Card ${index + 1} of ${cards.length}` : `Test complete · ${cards.length} cards`;
      $('position').textContent = state.presets.find(p => p.id === sessionPresetId)?.name || '';
      $('testCard').classList.toggle('summary', !w);
      $('word').textContent = w?.hanzi || '完成';
      const glyphCount = [...(w?.hanzi || '完成')].length;
      const glyphSize = Math.min(96, Math.max(32, Math.floor(($('testCard').clientWidth - 48) / glyphCount)));
      $('testCard').style.setProperty('--glyph-size', `${glyphSize}px`);
      $('answer').innerHTML = w ? revealed ? `<strong>${escape(w.pinyin)}</strong><br>${escape(w.meaning)}` : '<span class="muted">Think of its sound and meaning</span>' : '<span class="muted">Start another test when you’re ready.</span>';
      $('actions').innerHTML = w ? revealed ? '<button class="grade again" id="again">Mark Incorrect</button><button class="grade good" id="good">Mark Correct</button>' : '<button class="primary" id="reveal">Reveal answer</button>' : '<button class="primary" id="beginTest">Start Test</button>';
      if ($('again')) $('again').onclick = () => rate(false);
      if ($('good')) $('good').onclick = () => rate(true);
      if ($('reveal')) $('reveal').onclick = () => { revealed = true; renderTest(); };
      if ($('beginTest')) $('beginTest').onclick = () => start();
      if (!w && completedStats) {
        const button = document.createElement('button');
        button.id = 'viewStats'; button.className = 'grade'; button.textContent = 'View statistics';
        button.onclick = showStatistics; $('actions').appendChild(button);
      }
      if (w && state.stroke) animateWord(w.hanzi, renderToken, glyphSize, writerPromise || (writerPromise = loadWriter()));
    }
    async function animateWord(text, token, glyphSize, loading) {
      $('strokeStatus').textContent = 'Loading stroke animation…';
      try {
        const HW = await loading;
        if (token !== renderToken || !state.stroke) return;
        const chars = [...text].filter(c => /[\u3400-\u9fff]/u.test(c));
        if (!chars.length) throw new Error('No characters available');
        const target = $('strokeVisual');
        target.replaceChildren(); target.classList.remove('hidden'); $('word').classList.add('hidden');
        $('strokeStatus').textContent = '';
        const writers = chars.map(char => {
          const el = document.createElement('div'); target.appendChild(el);
          return HW.create(el, char, { width:glyphSize, height:glyphSize, padding:Math.max(4,Math.round(glyphSize*.07)), showCharacter:false, showOutline:true, strokeColor:'#174b40', outlineColor:'#bed7c8', strokeAnimationSpeed:2, delayBetweenStrokes:180, onLoadCharDataError: () => { if (token === renderToken) { $('strokeStatus').textContent = 'Stroke data unavailable. The word is shown normally.'; $('word').classList.remove('hidden'); target.classList.add('hidden'); } } });
        });
        while (token === renderToken && state.stroke) {
          for (const writer of writers) {
            if (token !== renderToken || !state.stroke) return;
            await writer.animateCharacter();
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
          if (token !== renderToken || !state.stroke) return;
          writers.forEach(writer => writer.hideCharacter({ duration: 0 }));
        }
      } catch {
        if (token !== renderToken) return;
        writerPromise = null;
        $('strokeStatus').textContent = 'Stroke animation unavailable. The word is shown normally.';
        $('word').classList.remove('hidden'); $('strokeVisual').classList.add('hidden');
      }
    }
    $('startTest').onclick = () => {
      const level = selected().builtinLevel;
      if (level && !studyLevel) {
        save();
        location.assign(`/study/hsk-${level === 7 ? '7-9' : level}/`);
      } else start();
    };
    $('cardCountChips').onclick = e => {
      const chip = e.target.closest('[data-card-count]');
      if (!chip) return;
      const count = Number(chip.dataset.cardCount);
      if (!cardCounts.includes(count)) return;
      state.cardCount = count;
      save();
      renderHome();
      $('cardCountChips').querySelector(`[data-card-count="${count}"]`).focus();
    };
    $('backHome').onclick = () => {
      if (!leaveTest()) return;
      if (studyLevel) location.assign('/study/');
      else renderHome();
    };
    $('presetForm').onsubmit = e => {
      e.preventDefault();
      const selectedLevels = levels.filter(n => $(`level${n}`).checked), name = $('presetName').value.trim();
      if (!name || !selectedLevels.length) { $('formError').textContent = 'Give this preset a name and choose at least one level.'; return; }
      const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      state.presets.push({ id, name, levels:selectedLevels }); state.activeId = id; save();
      $('presetForm').reset(); $('presetForm').classList.add('hidden'); $('formError').textContent = ''; renderHome();
    };
    for (const id of ['strokeToggle','strokeInTest']) $(id).onchange = e => { state.stroke = e.target.checked; save(); $('strokeToggle').checked = state.stroke; $('strokeInTest').checked = state.stroke; if (!$('test').classList.contains('hidden')) renderTest(); };
    $('export').onclick = () => { const blob = new Blob([JSON.stringify(state,null,2)], { type:'application/json' }), a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='MyHanzi-backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
    $('import').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (![2,3].includes(data.version) || !Array.isArray(data.presets) || !data.presets.length || data.presets.some(p => !p.id || !Array.isArray(p.levels)) || (data.version === 2 && data.presets.some(p => !p.progress || typeof p.progress !== 'object')) || (data.version === 3 && (!data.progress || typeof data.progress !== 'object'))) throw Error(); state=data; ensureSharedProgress(); ensureLevelPresets(); save(); renderHome(); } catch { alert('Could not read this backup file.'); } e.target.value=''; };
    document.addEventListener('keydown', e => { if ($('test').classList.contains('hidden') || e.target instanceof HTMLInputElement || !cards[index]) return; if (e.code==='Space' && !revealed) { e.preventDefault(); revealed=true; renderTest(); } else if (revealed && e.key==='1') rate(false); else if (revealed && e.key==='2') rate(true); });
    renderHome();
    if (studyLevel) start();
  }
  function initVocabulary() {
    const browseCount = $('browseCount');
    const levelActions = document.createElement('div');
    const startLevelTest = document.createElement('a');
    levelActions.className = 'vocab-level-actions';
    startLevelTest.className = 'primary';
    levelActions.append(browseCount, startLevelTest);
    document.querySelector('.vocab-head').append(levelActions);
    const characters = entries => new Set(entries.flatMap(w => [...w.hanzi].filter(c => /\p{Script=Han}/u.test(c))));
    for (const [i, tile] of [...document.querySelectorAll('.vocab-card')].entries()) {
      const band = levels[i];
      const entries = words.filter(w => w.level <= band);
      const introduced = words.filter(w => w.level === band);
      const earlier = characters(words.filter(w => w.level < band));
      const newCharacters = [...characters(introduced)].filter(c => !earlier.has(c)).length;
      const progress = state.progress;
      const { reviewed, familiarity, percent } = levelProgress(introduced, progress);
      tile.innerHTML = `<span class="eyebrow">2026 syllabus</span><strong>${levelLabel(band)}</strong><span class="vocab-metrics"><span><b>${entries.length.toLocaleString()}</b> Total words</span><span><b>${introduced.length.toLocaleString()}</b> New words</span><span><b>${newCharacters.toLocaleString()}</b> New characters</span></span><span class="level-progress"><span class="progress-heading">Progress <b>${percent}%</b></span><progress max="100" value="${percent}" aria-label="${levelLabel(band)} progress">${percent}%</progress><span class="progress-detail">${reviewed.toLocaleString()} / ${introduced.length.toLocaleString()} level words reviewed · ${(familiarity * 100).toFixed(1)}% familiarity</span></span>`;
    }
    let level = null, animationToken = 0, popupWriterPromise = null;
    let popupWriters = [];
    function showLevel(n) { level=n; $('vocabOverview').classList.add('hidden'); $('vocabDetail').classList.remove('hidden'); $('levelTitle').textContent=levelLabel(n); $('search').value=''; $('wordPreview').close(); startLevelTest.href = `/study/hsk-${n === 7 ? '7-9' : n}/`; startLevelTest.textContent = `Start ${levelLabel(n)} test`; document.title = `${levelLabel(n)} Vocabulary · MyHanzi`; renderGrid(); }
    function renderGrid() {
      if (!level) return;
      const q = norm($('search').value.trim());
      const items = words.filter(w => w.level <= level && (!q || norm(`${w.hanzi} ${w.pinyin} ${w.meaning}`).includes(q))).sort((a,b) => norm(a.pinyin).localeCompare(norm(b.pinyin)) || a.hanzi.localeCompare(b.hanzi));
      $('browseCount').textContent = `${items.length.toLocaleString()} of ${words.filter(w => w.level <= level).length.toLocaleString()} words · ${level === 7 ? 'HSK 7–9 shared list, including HSK 1–6' : `includes HSK 1–${level}`}`;
      $('grid').innerHTML = items.length ? items.map(w => `<button class="tile" data-word="${escape(w.id)}" style="background:${shade(colorStep(state.progress[w.id]))}" aria-label="${escape(w.hanzi)}, ${escape(w.pinyin)}">${escape(w.hanzi)}<small>${escape(w.pinyin)}</small></button>`).join('') : '<div class="empty">No matching words.</div>';
    }
    $('grid').addEventListener('click', e => {
      const tile = e.target.closest('[data-word]');
      if (!tile) return;
      const w = wordsById.get(tile.dataset.word);
      if (!w) return;
      $('wordTitle').textContent = w.hanzi;
      $('wordPinyin').textContent = w.pinyin;
      $('wordMeaning').textContent = w.meaning;
      $('wordPreview').showModal();
      animatePopup(w.hanzi);
    });
    const dialog = $('wordPreview');
    function stopPopupAnimation() {
      animationToken++;
      popupWriters.forEach(writer => writer.pauseAnimation());
      popupWriters = [];
    }
    dialog.addEventListener('close', stopPopupAnimation);
    async function animatePopup(text) {
      stopPopupAnimation();
      const token = animationToken;
      const current = () => token === animationToken && dialog.open;
      const target = $('popupStrokes'), title = $('wordTitle'), status = $('popupStrokeStatus');
      target.replaceChildren();
      target.classList.add('hidden');
      title.classList.remove('sr-only');
      status.textContent = 'Loading stroke animation…';
      try {
        const HW = await (popupWriterPromise || (popupWriterPromise = loadWriter().catch(error => {
          popupWriterPromise = null;
          throw error;
        })));
        if (!current()) return;
        const chars = [...text];
        const size = Math.min(96, Math.floor((dialog.clientWidth - 56) / Math.min(chars.length, 4)));
        const ready = [];
        popupWriters = chars.filter(char => /[\u3400-\u9fff]/u.test(char)).map(char => {
          const el = document.createElement('div');
          target.appendChild(el);
          let loaded, failed;
          ready.push(new Promise((resolve, reject) => { loaded = resolve; failed = reject; }));
          return HW.create(el, char, {
            width:size, height:size, padding:6, showCharacter:false, showOutline:true,
            strokeColor:'#174b40', outlineColor:'#bed7c8', strokeAnimationSpeed:2, delayBetweenStrokes:180,
            onLoadCharDataSuccess:loaded,
            onLoadCharDataError:() => failed(new Error('Stroke data unavailable'))
          });
        });
        if (!popupWriters.length) throw new Error('No characters available');
        await Promise.all(ready);
        if (!current()) return;
        title.classList.add('sr-only');
        target.classList.remove('hidden');
        status.textContent = '';
        const writers = [...popupWriters];
        while (current()) {
          for (const writer of writers) {
            if (!current()) return;
            await writer.animateCharacter();
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
          if (!current()) return;
          await Promise.all(writers.map(writer => writer.hideCharacter({ duration:0 })));
        }
      } catch {
        if (!current()) return;
        stopPopupAnimation();
        title.classList.remove('sr-only');
        target.classList.add('hidden');
        status.textContent = 'Stroke animation unavailable. The word is shown normally.';
      }
    }
    dialog.addEventListener('click', e => {
      const bounds = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom)) dialog.close();
    });
    const route = location.pathname.match(/^\/vocabulary\/hsk-([1-9]|7-9)(?:\/|\/index\.html)?$/);
    if (route) {
      const band = route[1] === '7-9' ? 7 : Math.min(7, Number(route[1]));
      showLevel(band);
    }
    $('search').oninput=renderGrid;
    const swatches = Array.from({length:10},(_,i)=>`<i style="background:${shade(i)}" title="Familiarity ${i+1} of 10"></i>`).join('');
    for (const id of ['swatchesTop', 'swatches']) $(id).innerHTML = swatches;
  }
})();
