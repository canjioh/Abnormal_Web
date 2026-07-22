/* ABNORMAL — the calculator page.

   Everything is synchronous: the heavy part is a binary-split series and one
   pass over the digits for each of the b(b−1)/2 pairs. At the top setting —
   200000 digits of π in base 16 — that is under two seconds, so a worker would
   buy complexity and nothing else. The one concession to the interface is that
   the "working" state is painted before the arithmetic starts. */

const UI = {};
let LAST = null;

function el(id) { return document.getElementById(id); }

function boot() {
  bootShell();

  UI.source = el('source');
  UI.custom = el('customWrap');
  UI.customKind = el('customKind');
  UI.customText = el('customText');
  UI.customCyclic = el('customCyclic');
  UI.base = el('base');
  UI.digits = el('digits');
  UI.digitsSlider = el('digitsSlider');
  UI.zmax = el('zmax');
  UI.zEcho = el('zEcho');
  UI.digitsEcho = el('digitsEcho');
  UI.run = el('run');
  UI.notice = el('notice');
  UI.note = el('sourceNote');
  UI.results = el('results');
  UI.pairI = el('pairI');
  UI.pairJ = el('pairJ');

  fillSources();
  fillBases();
  syncSourceNote();

  UI.source.addEventListener('change', () => { syncCustom(); syncSourceNote(); });
  UI.customKind.addEventListener('change', syncCustom);
  UI.base.addEventListener('change', () => { fillPairs(); syncDigits(); });
  UI.digits.addEventListener('input', () => {
    UI.digitsSlider.value = digitsToSlider(clampDigits(UI.digits.value));
    syncDigits();
  });
  UI.digitsSlider.addEventListener('input', () => {
    UI.digits.value = sliderToDigits(parseInt(UI.digitsSlider.value, 10));
    syncDigits();
  });
  UI.zmax.addEventListener('input', syncZ);
  UI.run.addEventListener('click', () => { run(); });
  UI.pairI.addEventListener('change', renderSwap);
  UI.pairJ.addEventListener('change', renderSwap);
  el('csv').addEventListener('click', downloadCsv);

  syncCustom();
  syncZ();
  UI.digitsSlider.value = digitsToSlider(clampDigits(UI.digits.value));
  syncDigits();
  fillPairs();
  run();
}

/* Your own number first, the specimens after it: the point of the page is the
   number you brought, and the catalogue is there to have something to compare
   it with. */
function fillSources() {
  const groups = [];
  for (const e of LIBRARY) {
    let g = groups.find((x) => x.name === e.group);
    if (!g) { g = { name: e.group, items: [] }; groups.push(g); }
    g.items.push(e);
  }
  let html = '<optgroup label="Your own number">' +
    '<option value="custom">▸ type a fraction or a digit string…</option></optgroup>';
  for (const g of groups) {
    html += `<optgroup label="${g.name}">`;
    for (const e of g.items) html += `<option value="${e.id}">${e.name}</option>`;
    html += '</optgroup>';
  }
  UI.source.innerHTML = html;
  UI.source.value = 'pi';
}

/* The useful range spans four decades, so a linear slider would spend nine
   tenths of its travel between ten and twenty million. */
const DIG_MIN = 1000, DIG_MAX = 20000000;
function sliderToDigits(v) {
  const t = v / 1000;
  const d = Math.pow(10, Math.log10(DIG_MIN) + t * (Math.log10(DIG_MAX) - Math.log10(DIG_MIN)));
  return Math.max(200, Math.round(d / 100) * 100);
}
function digitsToSlider(n) {
  const t = (Math.log10(Math.max(DIG_MIN, n)) - Math.log10(DIG_MIN)) / (Math.log10(DIG_MAX) - Math.log10(DIG_MIN));
  return Math.round(Math.max(0, Math.min(1, t)) * 1000);
}

function fillBases() {
  let html = '';
  for (let b = 2; b <= 16; b++) html += `<option value="${b}">${b}</option>`;
  UI.base.innerHTML = html;
  UI.base.value = '10';
}

function fillPairs() {
  const b = parseInt(UI.base.value, 10);
  const keep = (sel, def) => {
    const was = parseInt(sel.value, 10);
    let html = '';
    for (let d = 0; d < b; d++) html += `<option value="${d}">${digitToChar(d)}</option>`;
    sel.innerHTML = html;
    sel.value = String(isFinite(was) && was < b ? was : Math.min(def, b - 1));
  };
  keep(UI.pairI, 0);
  keep(UI.pairJ, 1);
}

function syncCustom() {
  const isCustom = UI.source.value === 'custom';
  UI.custom.hidden = !isCustom;
  const kind = UI.customKind.value;
  el('cyclicWrap').hidden = kind !== 'digits';
  UI.customText.placeholder = kind === 'rational'
    ? '7930067/16843009'
    : 'digits in the chosen base, e.g. 1320201331020231';
}

function syncSourceNote() {
  const spec = libraryById(UI.source.value);
  UI.note.textContent = spec ? spec.note : 'Give a fraction p/q, or a string of digits in the chosen base.';
}

function syncZ() {
  UI.zEcho.textContent = strictness().toFixed(1) + ' σ';
  if (LAST) { renderVerdict(); renderScheme(); }
}

/* How many estimated standard errors an entry may sit away from the prescribed
   value before it is called a miss. Four is the usual compromise, once you
   remember that a base-16 table asks 120 × 16 questions at once. */
function strictness() {
  return parseInt(UI.zmax.value, 10) / 2;
}

function clampDigits(v) {
  let n = parseInt(v, 10);
  if (!isFinite(n)) n = 50000;
  return Math.max(200, Math.min(DIG_MAX, n));
}

/* Say what the run is going to cost before it is started, when it is going to
   cost anything worth mentioning. */
function syncDigits() {
  const n = clampDigits(UI.digits.value);
  const b = parseInt(UI.base.value, 10) || 10;
  const secs = estimateSeconds(b, n);
  UI.digitsEcho.textContent = n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n.toLocaleString('en');
  const warn = el('slowNote');
  if (warn) warn.textContent = secs > 4 ? `about ${secs < 60 ? Math.round(secs) + ' s' : Math.round(secs / 60) + ' min'} of arithmetic at this size` : '';
}

/* ---------- running ---------- */

function setProgress(frac, label) {
  const box = el('progress');
  box.hidden = false;
  el('progressFill').style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%';
  el('progressPct').textContent = Math.round(frac * 100) + '%';
  el('progressLabel').textContent = label;
}

function hideProgress() { el('progress').hidden = true; }

/* A rough idea of the wait, from the two things that drive it: the digits have
   to be produced once, and then read b(b−1)/2 times. Worth saying out loud
   before a run that is going to take a minute. */
function estimateSeconds(b, n) {
  return (b * (b - 1) / 2) * n * 1.1e-6 / 45;
}

async function run() {
  UI.notice.textContent = '';
  UI.run.disabled = true;
  UI.run.textContent = 'working…';
  setProgress(0, 'starting');
  await new Promise((r) => setTimeout(r, 0));
  try {
    await doRun();
  } catch (err) {
    UI.notice.textContent = err && err.message ? err.message : String(err);
    UI.results.hidden = true;
  } finally {
    UI.run.disabled = false;
    UI.run.textContent = 'compute';
    hideProgress();
  }
}

async function doRun() {
  const b = parseInt(UI.base.value, 10);
  const n = clampDigits(UI.digits.value);
  UI.digits.value = n;
  UI.digitsSlider.value = Math.max(1000, n);

  const t0 = performance.now();

  setProgress(0.02, 'producing the digits');
  await new Promise((r) => setTimeout(r, 0));
  const built = buildSource(b, n);
  const source = built.source;

  // A period may legitimately be three digits long and still give an exact
  // answer; only a prefix needs to be long enough to measure anything.
  if (source.length < 2) throw new Error('Nothing to work with: at least two digits are needed.');
  if (!built.exact && source.length < 50) throw new Error('Too few digits to measure anything: give at least 50.');

  const pairs = b * (b - 1) / 2;
  const an = await analyse(source, b, built.exact, strictness(), (f) => {
    setProgress(0.1 + 0.85 * f, `pair ${Math.round(f * pairs)} of ${pairs} · ${source.length.toLocaleString('en')} digits`);
  });
  const ms = performance.now() - t0;

  setProgress(0.97, 'drawing');
  await new Promise((r) => setTimeout(r, 0));

  LAST = { b, n, an, built, ms };
  UI.results.hidden = false;
  renderVerdict();
  renderSwap();
  renderFrequencies();
  renderScheme();
  renderDelta();

  if (built.warn) UI.notice.textContent = built.warn;
}

/* Turn the current selection into a digit array, plus whether the analysis it
   supports is exact (a full period) or a measurement on a prefix. */
function buildSource(b, n) {
  const id = UI.source.value;

  if (id === 'custom') {
    const raw = UI.customText.value.trim();
    if (!raw) throw new Error('Nothing to compute: type a fraction or a digit string.');

    if (UI.customKind.value === 'rational') {
      const m = raw.match(/^\s*(-?\d+)\s*\/\s*(\d+)\s*$/);
      if (!m) throw new Error('Write the fraction as p/q, for instance 7930067/16843009.');
      const p = BigInt(m[1]);
      const q = BigInt(m[2]);
      if (q === 0n) throw new Error('The denominator cannot be zero.');
      return fromRational(p, q, b, n, `${m[1]}/${m[2]}`);
    }

    const cleaned = raw.replace(/^0[.,]/, '').replace(/[\s_.,]/g, '').toLowerCase();
    const arr = new Uint8Array(cleaned.length);
    for (let k = 0; k < cleaned.length; k++) {
      const d = charToDigit(cleaned[k]);
      if (d < 0 || d >= b) throw new Error(`"${cleaned[k]}" is not a digit in base ${b}.`);
      arr[k] = d;
    }
    if (UI.customCyclic.checked) {
      return { source: arr, exact: true, label: 'your period', detail: `period of length ${arr.length}` };
    }
    return { source: arr, exact: false, label: 'your digits', detail: `${arr.length} digits as given` };
  }

  const spec = libraryById(id);
  if (!spec) throw new Error('Unknown source.');

  if (spec.kind === 'rational') return fromRational(spec.p, spec.q, b, n, spec.name);

  let use = n;
  let warn = null;
  if (n > spec.max) { use = spec.max; warn = `${spec.name} is capped at ${spec.max.toLocaleString('en')} digits here.`; }
  const digits = spec.f(b, use);
  return { source: digits, exact: false, label: spec.name, detail: `${digits.length.toLocaleString('en')} digits`, warn };
}

function fromRational(p, q, b, n, label) {
  const budget = Math.max(n, 2000);
  const r = rationalDigits(p, q, b, budget, true);
  if (r.periodStart >= 0) {
    const period = r.digits.slice(r.periodStart);
    return {
      source: period,
      exact: true,
      label,
      detail: `exact — period of length ${period.length.toLocaleString('en')}` +
              (r.periodStart ? `, after ${r.periodStart} pre-period digit${r.periodStart > 1 ? 's' : ''}` : ''),
    };
  }
  return {
    source: r.digits,
    exact: false,
    label,
    detail: `${r.digits.length.toLocaleString('en')} digits (period longer than the budget)`,
    warn: 'The period did not close within the digit budget, so the densities below are measurements and not exact values. Raise the digit count for an exact answer.',
  };
}

/* ---------- rendering ---------- */

function fmt(x, k) { return x.toFixed(k === undefined ? 5 : k); }

/* A standard-error count can be genuinely infinite: when every batch agrees
   exactly and the value is still wrong — the digits the lemma forbids, for
   instance — no amount of data would explain the gap. Printing "Infinity"
   would look like a bug, so it is set as the symbol it is. */
function fmtZ(z) { return isFinite(z) ? z.toFixed(1) : '∞'; }

function frac(num, den) {
  const g = gcd(num, den) || 1;
  return `${num / g}/${den / g}`;
}

/* The one place colour is decided. Direction is repeated as a caret so the
   table still reads without it. */
function tint(diff, weight) {
  if (!weight) return '';
  const pct = Math.min(58, Math.round(weight * 58));
  const hue = diff > 0 ? '--hot' : '--cool';
  return ` style="background: color-mix(in srgb, var(${hue}) ${pct}%, transparent)"`;
}

function caret(diff) { return diff > 0 ? '▲' : (diff < 0 ? '▼' : ''); }

function renderVerdict() {
  const { b, an, built, ms } = LAST;
  const flag = (v) => `<span class="v ${v ? 'yes' : 'no'}"><span class="glyph">${v ? '✓' : '✗'}</span> ${v ? 'yes' : 'no'}</span>`;

  el('verdict').innerHTML = `
    <div class="cell"><span class="k">number</span><span class="v small">${escapeHtml(built.label)}</span></div>
    <div class="cell"><span class="k">base</span><span class="v">${b}</span></div>
    <div class="cell"><span class="k">sample</span><span class="v small">${escapeHtml(built.detail)}</span></div>
    <div class="cell"><span class="k">simply ${b}-normal</span>${flag(an.simplyNormal)}</div>
    <div class="cell"><span class="k">${b}-pseudonormal</span>${flag(an.pseudonormal)}</div>
    <div class="cell"><span class="k">largest deviation</span><span class="v small">${fmt(an.maxDev, 6)}${an.exact ? '' : ` &nbsp;=&nbsp; ${fmtZ(an.maxZ)} σ`}</span></div>
    <div class="cell"><span class="k">spread within a δ class</span><span class="v small">${fmt(an.spread, 6)}${an.spreadDelta > 0 ? ` (δ = ${an.spreadDelta})` : ''}</span></div>
    <div class="cell"><span class="k">computed in</span><span class="v small">${ms.toFixed(0)} ms</span></div>
  `;

  const note = el('verdictNote');
  if (an.exact) {
    note.innerHTML = an.pseudonormal
      ? 'The expansion is periodic, so these densities are exact rational numbers and the verdict is a proof, not an estimate.'
      : 'The expansion is periodic, so these densities are exact: the mismatch below is real, and no amount of extra digits will remove it.';
  } else {
    note.innerHTML = 'The expansion is not known to be periodic, so every density here is measured on a finite prefix, and the verdict reads ' +
      `<em>yes</em> when no entry sits further than ${fmt(strictness(), 1)} estimated standard errors from the prescribed value. ` +
      'That is evidence and never a proof. The error is estimated from the scatter of the sample cut into ' + blockCount(an.digits.total) + ' batches: ' +
      `the digits 0 and ${digitToChar(b - 1)} of Δ come in runs decided by a single borrow, so they carry far less information than their count suggests, ` +
      'and a naive binomial error would call every constant a failure.';
    if (!an.pseudonormal && an.maxZ < 2 * strictness()) {
      note.innerHTML += ` <strong>This one is a near miss (${fmtZ(an.maxZ)} σ): raise the digit count before concluding anything.</strong>`;
    }
  }
}

function renderSwap() {
  if (!LAST) return;
  const { b, an, built } = LAST;
  const i = Math.min(parseInt(UI.pairI.value, 10) || 0, b - 1);
  const j = Math.min(parseInt(UI.pairJ.value, 10) || 0, b - 1);
  const src = built.source;

  let perm = '';
  for (let d = 0; d < b; d++) {
    const to = d === i ? j : (d === j ? i : d);
    perm += `<span class="cellmap${to !== d ? ' moved' : ''}">${digitToChar(d)}→${digitToChar(to)}</span>`;
  }
  el('perm').innerHTML = perm;

  if (i === j) {
    el('strips').innerHTML = '<p class="dim">Choose two different digits: \\(\\sigma^{i,i}\\) is the identity.</p>';
    typesetMath([el('strips')]);
    el('swapMeta').innerHTML = '';
    return;
  }

  const show = Math.min(src.length, 150);
  const sw = swapMap(src, i, j);
  const d = built.exact ? deltaCyclic(src, b, i, j) : deltaPrefix(src, b, i, j);

  const stripSwap = (arr) => {
    let s = '';
    for (let k = 0; k < show; k++) {
      const c = digitToChar(arr[k]);
      s += (arr[k] === i || arr[k] === j) ? `<span class="sw">${c}</span>` : c;
    }
    return s;
  };
  const stripDelta = (arr) => {
    let s = '';
    for (let k = 0; k < show; k++) {
      const c = digitToChar(arr[k]);
      s += (arr[k] === 0 || arr[k] === b - 1) ? `<span class="lo">${c}</span>` : `<span class="hi">${c}</span>`;
    }
    return s;
  };
  const tail = src.length > show ? '<span class="pt"> …</span>' : '';

  // The row labels are real mathematics — a Delta carries a subscript and a
  // superscript at once, which HTML sets one after the other and TeX sets
  // where they belong. Note the doubled backslashes: inside a template literal
  // a lone \( is swallowed as an escape and MathJax never sees a delimiter.
  el('strips').innerHTML = `
    <div class="strip"><span class="slabel">\\(\\omega\\)</span><div class="digits">0.${stripSwap(src)}${tail}</div></div>
    <div class="strip"><span class="slabel">\\(\\sigma^{${digitToChar(i)},${digitToChar(j)}}_{(${b})}(\\omega)\\)</span><div class="digits">0.${stripSwap(sw)}${tail}</div></div>
    <div class="strip"><span class="slabel">\\(\\Delta_{${b}}^{\\,${digitToChar(i)},${digitToChar(j)}}(\\omega)\\)</span><div class="digits">0.${d ? stripDelta(d) + tail : ''}</div></div>
  `;
  typesetMath([el('strips')]);

  if (!d) {
    el('swapMeta').innerHTML = '<p class="dim">Neither digit occurs, so σ fixes ω and this line of the scheme is trivial.</p>';
    return;
  }

  const delta = Math.abs(i - j);
  const allowed = [delta, b - delta, delta - 1, b - delta - 1, b - 1, 0].map((x) => ((x % b) + b) % b);
  const uniq = [...new Set(allowed)].sort((a, c) => a - c).map(digitToChar).join(', ');
  const row = an.rows.find((r) => r.i === Math.min(i, j) && r.j === Math.max(i, j));
  el('swapMeta').innerHTML = `
    <table class="kv">
      <tr><th>\\(\\delta = |i - j|\\)</th><td>${delta}</td></tr>
      <tr><th>digits the lemma allows</th><td>${uniq}</td></tr>
      <tr><th>digits actually present</th><td>${presentDigits(d, b)}</td></tr>
      <tr><th>deviation of this line</th><td>${row && !row.trivial
        ? fmt(row.score.dev, 6) + (an.exact ? '' : ` (${fmtZ(row.score.z)} σ)`) : '—'}</td></tr>
    </table>`;
  typesetMath([el('swapMeta')]);
}

function presentDigits(arr, b) {
  const c = digitCounts(arr, b);
  const out = [];
  for (let h = 0; h < b; h++) if (c[h]) out.push(digitToChar(h));
  return out.join(', ');
}

function renderFrequencies() {
  const { b, an } = LAST;
  const target = 1 / b;
  const span = Math.max(target * 1.6, ...an.digits.freq);
  let html = '';
  for (let h = 0; h < b; h++) {
    const f = an.digits.freq[h];
    const dev = f - target;
    const dir = dev > 0 ? 'over' : (dev < 0 ? 'under' : '');
    const exactTxt = an.exact ? ` = ${frac(an.digits.counts[h], an.digits.total)}` : '';
    html += `<div class="barrow">
      <span class="lbl">${digitToChar(h)}</span>
      <span class="bartrack"><span class="barfill ${dir}" style="width:${Math.min(100, (f / span) * 100).toFixed(2)}%"></span><span class="mark" style="left:${((target / span) * 100).toFixed(2)}%"></span></span>
      <span class="barval">${fmt(f)} <span class="dev ${dir}">${caret(dev)}${fmt(Math.abs(dev))}</span><span class="dim">${exactTxt}</span></span>
    </div>`;
  }
  el('bars').innerHTML = html;
  el('freqNote').innerHTML = `Expected density 1/${b} = ${fmt(target)}, marked by the rule on each track. ` +
    `Largest departure ${fmt(an.digits.dev, 6)}` +
    (an.exact ? ' — exact.' : `, i.e. ${fmtZ(an.digits.z)} σ.`);
}

function renderScheme() {
  const { b, an } = LAST;
  const zmax = strictness();
  let head = '<tr><th class="idx idx-i">i</th><th class="idx idx-j">j</th><th class="idx idx-d">δ</th>';
  for (let h = 0; h < b; h++) head += `<th>P[${digitToChar(h)}]</th>`;
  head += `<th class="tot">${an.exact ? 'dev' : 'max σ'}</th></tr>`;

  let body = '';
  for (const r of an.rows) {
    if (r.trivial) {
      body += `<tr><th class="idx idx-i">${digitToChar(r.i)}</th><td class="idx idx-j">${digitToChar(r.j)}</td>` +
        `<td class="idx idx-d">${r.delta}</td>` +
        `<td colspan="${b + 1}" class="zero">σ fixes ω — line omitted</td></tr>`;
      continue;
    }
    const bad = an.exact ? !r.score.exactMatch : r.score.z > zmax;
    body += `<tr${bad ? ' class="bad"' : ''}><th class="idx idx-i">${digitToChar(r.i)}</th>` +
      `<td class="idx idx-j">${digitToChar(r.j)}</td><td class="idx idx-d">${r.delta}</td>`;
    for (let h = 0; h < b; h++) {
      const target = r.expected[h] / (2 * b);
      const diff = r.freq[h] - target;
      const miss = an.exact
        ? (r.counts[h] * 2 * b !== r.expected[h] * r.total)
        : (r.score.zs && r.score.zs[h] > zmax);
      // intensity: how far out, relative to the strictness threshold
      const weight = an.exact
        ? (miss ? 0.75 : 0)
        : Math.min(1, (r.score.zs ? r.score.zs[h] : 0) / (zmax * 1.5));
      const cls = (r.freq[h] === 0 && target === 0) ? 'zero' : (miss ? (diff > 0 ? 'over' : 'under') : '');
      const title = an.exact
        ? `${frac(r.counts[h], r.total)} — prescribed ${r.expected[h]}/${2 * b}`
        : `prescribed ${fmt(target)} — off by ${fmtZ(r.score.zs ? r.score.zs[h] : 0)} σ`;
      body += `<td class="${cls}"${tint(diff, weight)} title="${title}">${miss ? caret(diff) : ''}${fmt(r.freq[h])}</td>`;
    }
    body += `<td class="tot">${an.exact ? fmt(r.score.dev, 6) : fmtZ(r.score.z)}</td></tr>`;
  }

  el('schemeTable').innerHTML =
    `<caption>\\(\\Delta_{${b}}\\)-scheme of ${escapeHtml(LAST.built.label)} — ${an.rows.length} lines, one per unordered pair. ` +
    `Flagged entries miss the prescribed value ${an.exact ? 'exactly' : `by more than ${fmt(zmax, 1)} standard errors`}.</caption>` +
    `<thead>${head}</thead><tbody>${body}</tbody>`;
  typesetMath([el('schemeTable').querySelector('caption')]);
}

function renderDelta() {
  const { b, an } = LAST;
  const rows = collapseByDelta(an.rows, b);

  let head = '<tr><th class="idx idx-i">δ</th>';
  for (let h = 0; h < b; h++) head += `<th>P[${digitToChar(h)}]</th>`;
  head += '</tr>';

  let obs = '';
  for (const r of rows) {
    obs += `<tr><th class="idx idx-i">${r.delta}</th>`;
    for (let h = 0; h < b; h++) {
      const target = r.expected[h] / (2 * b);
      const diff = r.freq[h] - target;
      const weight = Math.min(1, Math.abs(diff) * 8);
      obs += `<td class="${r.freq[h] === 0 ? 'zero' : ''}"${tint(diff, weight)}>${fmt(r.freq[h])}</td>`;
    }
    obs += '</tr>';
  }
  el('deltaObs').innerHTML = `<caption>Observed, averaged over the lines with the same δ</caption><thead>${head}</thead><tbody>${obs}</tbody>`;

  let exp = '';
  for (let delta = 1; delta <= b - 1; delta++) {
    const u = expectedUnits(b, delta);
    exp += `<tr><th class="idx idx-i">${delta}</th>`;
    for (let h = 0; h < b; h++) {
      exp += `<td class="${u[h] === 0 ? 'zero' : ''}" title="${u[h]}/${2 * b}">${fmt(u[h] / (2 * b))}</td>`;
    }
    exp += '</tr>';
  }
  el('deltaExp').innerHTML = `<caption>Prescribed — the scheme of every ${b}-normal number</caption><thead>${head}</thead><tbody>${exp}</tbody>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- export ---------- */

function downloadCsv() {
  if (!LAST) return;
  const { b, an, built } = LAST;
  const lines = [];
  lines.push(`# ABNORMAL — Delta_${b}-scheme of ${built.label}`);
  lines.push(`# ${built.detail}${an.exact ? ' (exact)' : ' (measured on a prefix)'}`);
  lines.push(['i', 'j', 'delta', ...Array.from({ length: b }, (_, h) => `P[${digitToChar(h)}]`), 'dev', 'sigma'].join(','));
  for (const r of an.rows) {
    if (r.trivial) { lines.push([r.i, r.j, r.delta, ...Array(b).fill(''), 'trivial', ''].join(',')); continue; }
    lines.push([r.i, r.j, r.delta, ...Array.from(r.freq, (x) => x.toFixed(8)),
      r.score.dev.toFixed(8), an.exact ? '' : (isFinite(r.score.z) ? r.score.z.toFixed(3) : 'inf')].join(','));
  }
  lines.push('');
  lines.push('# prescribed scheme');
  lines.push(['delta', ...Array.from({ length: b }, (_, h) => `P[${digitToChar(h)}]`)].join(','));
  for (let d = 1; d <= b - 1; d++) {
    const u = expectedUnits(b, d);
    lines.push([d, ...Array.from(u, (x) => (x / (2 * b)).toFixed(8))].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `abnormal-scheme-base${b}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('DOMContentLoaded', boot);
