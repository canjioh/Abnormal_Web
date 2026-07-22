/* ABNORMAL — the cover figure, and the operation performed rather than stated.

   Three registers of π in base 10, in the same monospace grid so the columns
   line up: the expansion, the same expansion with 1 and 5 exchanged, and their
   difference. Read down any column and the whole subject is there.

   The animation is the argument. First the digits arrive. Then the swap happens
   where the reader can watch it: the 1s and the 5s lift out of the row and come
   back down as each other — that is the only thing that is done to the number.
   Then the difference fills in and collapses onto a handful of symbols in a grey
   field: whatever the number was, the borrows leave almost nothing behind. A
   static picture states that; this one demonstrates it, which is the point of
   putting it on the cover at all.

   Anyone who has asked for reduced motion gets the finished figure at once. */

const HERO = { timers: [], host: null };

function initHero(host) {
  if (!host) return;
  HERO.host = host;
  clearHero();

  const B = 10, I = 1, J = 5;

  // One character cell is measured, not guessed, so the three rows agree.
  const probe = document.createElement('span');
  probe.className = 'hdigits';
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  probe.textContent = '0'.repeat(100);
  host.appendChild(probe);
  const cellW = probe.getBoundingClientRect().width / 100 || 11;
  host.removeChild(probe);

  const width = host.clientWidth || 900;
  const labelW = width < 560 ? 0 : 122;              // the label column, in px
  const perRow = Math.max(24, Math.floor((width - labelW - 8) / cellW) - 2);
  const lines = width < 560 ? 3 : 4;
  const count = Math.min(PI_FRAC.length, perRow * lines);

  const digits = PI_FRAC.slice(0, count);
  const swapped = digits.map((d) => (d === I ? J : (d === J ? I : d)));
  const delta = subtractStrip(digits, swapped, B);

  const stack = document.createElement('div');
  stack.className = 'hero-rows';
  stack.style.setProperty('--labelw', labelW + 'px');

  // The integer part belongs to the number: π is 3.14159…, and the difference
  // starts 0. precisely because the two 3s cancel. Dropping it was a small lie.
  const rows = [
    { label: '\\(\\pi\\)', head: '3.', data: digits, kind: 'src' },
    { label: `\\(\\sigma^{${I},${J}}_{(${B})}(\\pi)\\)`, head: '3.', data: digits, kind: 'swp' },
    { label: `\\(\\Delta_{${B}}^{\\,${I},${J}}(\\pi)\\)`, head: '0.', data: delta, kind: 'dif' },
  ];

  rows.forEach((row) => {
    const el = document.createElement('div');
    el.className = 'hrow';
    const lab = document.createElement('div');
    lab.className = 'hlabel';
    lab.innerHTML = row.label;
    const dig = document.createElement('div');
    dig.className = 'hdigits';
    dig.innerHTML = `<i class="head">${row.head}</i>` +
      row.data.map((d, k) => cell(d, k, row.kind, I, J, B)).join('');
    el.appendChild(lab);
    el.appendChild(dig);
    stack.appendChild(el);
  });

  host.appendChild(stack);
  typesetMath([stack]);

  const cells = rows.map((_, r) => [...stack.children[r].querySelectorAll('.hdigits b')]);
  const heads = [...stack.querySelectorAll('.hdigits .head')];
  cells[1].forEach((c) => { if (c.dataset.to) c.dataset.from = c.textContent; });

  if (reducedMotion()) {
    heads.forEach((h) => h.classList.add('in'));
    cells.forEach((row) => row.forEach((c) => c.classList.add('in')));
    cells[1].forEach((c) => { if (c.dataset.to) c.textContent = c.dataset.to; });
    return;
  }

  host.onclick = () => runHero(cells, heads, count);
  runHero(cells, heads, count);
}

/* A single digit. Which of the three registers it belongs to decides how it is
   marked: the swapped symbols in vermilion, and in the difference the rare
   digits — anything that is not 0 or b−1 — in indigo against a grey field.

   The middle row is built holding the *original* digit, with the value it is
   going to become parked in data-to, so the exchange can happen on screen. */
function cell(d, k, kind, I, J, B) {
  let cls = '';
  let extra = '';
  if (kind === 'src') {
    if (d === I || d === J) cls = ' class="sw"';
  } else if (kind === 'swp') {
    if (d === I || d === J) {
      cls = ' class="sw"';
      extra = ` data-to="${d === I ? J : I}"`;
    }
  } else {
    cls = (d === 0 || d === B - 1) ? ' class="lo"' : ' class="hi"';
  }
  return `<b${cls}${extra} style="--k:${k}">${d}</b>`;
}

function clearHero() {
  HERO.timers.forEach(clearTimeout);
  HERO.timers = [];
  if (HERO.host) { HERO.host.innerHTML = ''; HERO.host.onclick = null; }
}

function at(ms, fn) { HERO.timers.push(setTimeout(fn, ms)); }

/* The timeline. Deliberately slow: the reader is meant to see the swap happen,
   not to catch it. */
function runHero(cells, heads, count) {
  HERO.timers.forEach(clearTimeout);
  HERO.timers = [];

  const stagger = Math.min(4.5, 900 / count);          // per-digit delay, ms
  const sweep = count * stagger;

  const show = (row) => {
    heads[row].classList.add('in');
    cells[row].forEach((c, k) => {
      c.style.transitionDelay = (k * stagger).toFixed(1) + 'ms';
      c.classList.add('in');
    });
  };
  const hide = (row) => {
    heads[row].classList.remove('in');
    cells[row].forEach((c) => {
      c.style.transitionDelay = '0ms';
      c.classList.remove('in', 'moved');
      if (c.dataset.from) c.textContent = c.dataset.from;
    });
  };

  cells.forEach((_, r) => hide(r));

  at(60, () => show(0));

  // the copy appears unchanged — digit for digit identical to the row above
  at(700 + sweep, () => show(1));

  // and then, visibly, the ones and the fives change places
  at(1500 + 2 * sweep, () => {
    cells[1].forEach((c, k) => {
      if (!c.dataset.to) return;
      at(k * stagger * 0.9, () => {
        c.classList.add('moved');
        // the face changes at the top of the arc, where the eye expects it
        at(230, () => { c.textContent = c.dataset.to; });
      });
    });
  });

  at(2900 + 3 * sweep, () => show(2));
  at(7800 + 4 * sweep, () => { cells.forEach((_, r) => hide(r)); });
  at(8600 + 4 * sweep, () => runHero(cells, heads, count));
}

/* Plain right-to-left subtraction of the smaller strip from the larger. */
function subtractStrip(a, c, b) {
  let sign = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] !== c[k]) { sign = a[k] > c[k] ? 1 : -1; break; } }
  const x = sign >= 0 ? a : c;
  const y = sign >= 0 ? c : a;
  const out = new Array(a.length);
  let borrow = 0;
  for (let k = a.length - 1; k >= 0; k--) {
    let t = x[k] - y[k] - borrow;
    if (t < 0) { t += b; borrow = 1; } else borrow = 0;
    out[k] = t;
  }
  return out;
}

/* 400 fractional digits of π in base 10 — enough for any cover width, and it
   keeps the landing page free of the BigInt machinery. */
const PI_FRAC = ('14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214' +
  '80865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659' +
  '33446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881' +
  '52092096282925409171536436789259036001133053054882046652138414695194151160943305727036575959195309218611738193')
  .split('').map(Number);
