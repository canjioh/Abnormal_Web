/* ABNORMAL — shared page shell: wordmark, navigation, palette toggle.

   A page registers PAGE.onTheme if it has something to redraw when the palette
   flips; anything not registered simply does not happen, so the cover does not
   drag in the calculator's machinery. */

const PAGE = { onTheme: null };

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('abnormal-theme', theme); } catch (e) { /* private mode */ }
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? 'light' : 'dark';
}

/* Split the wordmark into letters, then roll the vermilion through them like
   the wheels of an odometer and let it settle on the letter that belongs to
   this page — data-mark on the <h1>. The animation is not decoration: it is
   how the site says which of the three sections you have landed in, and the
   rolling is the same gesture the whole site is about, a digit changing
   position. Anyone who has asked for less motion gets the final state at once. */
function markWordmark() {
  const h1 = document.querySelector('.wordmark');
  if (!h1 || h1.dataset.built) return;
  const target = h1.querySelector('a') || h1;
  const word = target.textContent.trim();
  const which = parseInt(h1.dataset.mark || '0', 10) % word.length;

  target.innerHTML = [...word].map((c) => `<span class="ltr">${c}</span>`).join('');
  h1.dataset.built = '1';

  const letters = [...target.querySelectorAll('.ltr')];
  const land = () => letters.forEach((l, i) => l.classList.toggle('neg', i === which));

  if (reducedMotion() || letters.length < 2) { land(); return; }

  // one full circuit, ending on the page's letter
  const steps = letters.length + which;
  let k = 0;
  const tick = () => {
    letters.forEach((l, i) => l.classList.toggle('neg', i === k % letters.length));
    if (k++ < steps) setTimeout(tick, k < 3 ? 110 : 62 + k * 6);
    else land();
  };
  setTimeout(tick, 260);
}

function markActiveNav() {
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach((a) => {
    const target = a.getAttribute('href').toLowerCase();
    const isHome = here === '' || here === 'index.html';
    a.classList.toggle('active', target === here || (isHome && target === 'index.html'));
  });
}

/* MathJax is loaded after the page scripts and typesets the static markup by
   itself; anything built later has to ask. Chaining onto startup.promise is the
   documented way to do that without racing the initial pass. */
function typesetMath(nodes, tries) {
  if (!window.MathJax || !window.MathJax.startup) {
    // The library may still be parsing: wait for it rather than silently
    // leaving raw \( \) on the page, but give up rather than spin for ever.
    const left = tries === undefined ? 40 : tries;
    if (left > 0) setTimeout(() => typesetMath(nodes, left - 1), 80);
    return Promise.resolve();
  }
  MathJax.startup.promise = MathJax.startup.promise
    .then(() => MathJax.typesetPromise(nodes))
    .catch(() => { /* a formula that will not set is not worth an exception */ });
  return MathJax.startup.promise;
}

/* Reveal any .reveal element once it scrolls into view. Deliberately built on
   getBoundingClientRect and a scroll listener rather than IntersectionObserver:
   the observer depends on the compositing pipeline and silently never fires in
   a throttled or non-painting tab, which would leave the content invisible.
   Layout geometry is always available, so this cannot strand anything off. */
function initReveals() {
  let pending = [...document.querySelectorAll('.reveal')];
  if (!pending.length) return;
  if (reducedMotion()) { pending.forEach((el) => el.classList.add('in')); return; }

  const check = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    pending = pending.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.85 && r.bottom > 0) { el.classList.add('in'); return false; }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
  };
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  check();
}

function bootShell() {
  let stored = 'light';
  try { stored = localStorage.getItem('abnormal-theme') || 'light'; } catch (e) { /* ignore */ }
  setTheme(stored);
  markWordmark();
  markActiveNav();

  const tb = document.getElementById('themeBtn');
  if (tb) {
    tb.addEventListener('click', () => {
      setTheme(currentTheme() === 'light' ? 'dark' : 'light');
      if (typeof PAGE.onTheme === 'function') PAGE.onTheme();
    });
  }

  initReveals();
}
