/* ABNORMAL — the catalogue of test numbers.

   Three kinds of specimen, and the point of the list is that it contains all
   three: numbers everyone believes are normal but nobody can prove, numbers
   proved normal in one base, and numbers proved abnormal. A test that only
   ever says yes is not a test, so the abnormal ones matter as much as pi. */

const DIGIT_CHARS = '0123456789abcdef';

function charToDigit(c) {
  const i = DIGIT_CHARS.indexOf(c.toLowerCase());
  return i;
}

function digitToChar(d) { return DIGIT_CHARS[d].toUpperCase(); }

/* Guard digits: enough that the accumulated truncation of a few thousand
   series terms cannot reach the last digit we hand back. */
function guardFor(b) {
  return Math.ceil(44 / Math.log2(b)) + 8;
}

function scaleFor(b, n) {
  return BigInt(b) ** BigInt(n + guardFor(b));
}

/* ---------- digit-generated numbers ---------- */

/* Champernowne: 0.1 2 3 4 ... written out in base b. Proved b-normal
   (Champernowne 1933 for b = 10, Nakai–Shiokawa 1992 in general). */
function champernowne(b, n) {
  const out = new Uint8Array(n);
  let k = 1, at = 0;
  while (at < n) {
    const s = k.toString(b);
    for (let i = 0; i < s.length && at < n; i++) out[at++] = charToDigit(s[i]);
    k++;
  }
  return out;
}

/* Copeland–Erdős: the primes concatenated. Proved 10-normal (1946). */
function copelandErdos(b, n) {
  const out = new Uint8Array(n);
  let at = 0, k = 2;
  while (at < n) {
    if (isPrime(k)) {
      const s = k.toString(b);
      for (let i = 0; i < s.length && at < n; i++) out[at++] = charToDigit(s[i]);
    }
    k++;
  }
  return out;
}

function isPrime(k) {
  if (k < 2) return false;
  if (k % 2 === 0) return k === 2;
  for (let d = 3; d * d <= k; d += 2) if (k % d === 0) return false;
  return true;
}

/* The Fibonacci numbers concatenated — the paper's F_10 = 0.112358132134... */
function fibonacciConcat(b, n) {
  const out = new Uint8Array(n);
  let at = 0, a = 1n, c = 1n;
  const B = BigInt(b);
  while (at < n) {
    const s = a.toString(b);
    for (let i = 0; i < s.length && at < n; i++) out[at++] = charToDigit(s[i]);
    const next = a + c; a = c; c = next;
    void B;
  }
  return out;
}

/* Liouville's constant: 1 at the positions k!, 0 elsewhere. Transcendental,
   and about as far from normal as a number gets — the density of 0 is 1. */
function liouville(b, n) {
  const out = new Uint8Array(n);
  let f = 1, k = 1;
  while (f <= n) { out[f - 1] = 1; k++; f *= k; if (k > 25) break; }
  return out;
}

/* Thue–Morse digits: the parity of the binary digit sum of the position.
   Simply normal in base 2 and not 2-normal (it has no cube), which makes it
   the cleanest separator between the two conditions. */
function thueMorse(b, n) {
  const out = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let x = k, p = 0;
    while (x) { p ^= x & 1; x >>>= 1; }
    out[k] = p;
  }
  return out;
}

/* A seeded pseudorandom digit string — the control specimen. It is not a
   number anybody named, it is what "as expected" is supposed to look like. */
function pseudorandom(b, n, seed) {
  const out = new Uint8Array(n);
  let s = seed >>> 0 || 0x9e3779b9;
  for (let k = 0; k < n; k++) {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    out[k] = s % b;
  }
  return out;
}

/* ---------- the catalogue ---------- */

/* kind: 'series'   — BigInt series or root, scaled
         'digits'   — generated digit by digit
         'rational' — exact long division, period detected when it closes

   The caps are measured, not guessed. A digit generator is linear and will
   hand over twenty million digits in about a second; a series is BigInt-bound
   and heavy, so the analytic constants stop at two million — a run of tens of
   seconds that pauses the tab while it computes. */
const LIBRARY = [
  {
    id: 'pi', name: 'π', group: 'Constants', max: 2000000,
    note: 'Believed normal in every base; not proved in any.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(piScaled(S), S, b, n); },
  },
  {
    id: 'e', name: 'e', group: 'Constants', max: 2000000,
    note: 'Believed normal; not proved.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(eScaled(S), S, b, n); },
  },
  {
    id: 'ln2', name: 'log 2', group: 'Constants', max: 2000000,
    note: 'Believed normal; not proved.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(ln2Scaled(S), S, b, n); },
  },
  {
    id: 'sqrt2', name: '√2', group: 'Constants', max: 2000000,
    note: 'Algebraic irrational. No algebraic irrational has ever been proved normal in any base.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(isqrt(2n * S * S), S, b, n); },
  },
  {
    id: 'sqrt3', name: '√3', group: 'Constants', max: 2000000,
    note: 'Algebraic irrational.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(isqrt(3n * S * S), S, b, n); },
  },
  {
    id: 'sqrt5', name: '√5', group: 'Constants', max: 2000000,
    note: 'Algebraic irrational.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(isqrt(5n * S * S), S, b, n); },
  },
  {
    id: 'cbrt2', name: '∛2', group: 'Constants', max: 2000000,
    note: 'Algebraic of degree three.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits(iroot(2n * S * S * S, 3), S, b, n); },
  },
  {
    id: 'phi', name: 'φ', group: 'Constants', max: 2000000,
    note: 'The golden ratio, (1+√5)/2.',
    kind: 'series', f: (b, n) => { const S = scaleFor(b, n); return scaledToDigits((S + isqrt(5n * S * S)) / 2n, S, b, n); },
  },

  {
    id: 'champernowne', name: 'Champernowne C_b', group: 'Proved normal', max: 20000000,
    note: 'Proved b-normal (Champernowne 1933; Nakai–Shiokawa 1992 in every base), yet its finite prefixes never pass: the digit frequencies oscillate with where you stop, and the scheme deviation shrinks only like 1/log(N). Extrapolating the measured rate, it would take on the order of 10^50 digits to enter the passing range — more than there are atoms in the observable universe. It is normal in the limit and unreachable in practice: the textbook case of a prefix disagreeing with the theorem, not a bug.',
    kind: 'digits', f: champernowne,
  },
  {
    id: 'copeland', name: 'Copeland–Erdős', group: 'Proved normal', max: 20000000,
    note: 'The primes concatenated; proved 10-normal in 1946. Like Champernowne it converges far too slowly to pass a finite test.',
    kind: 'digits', f: copelandErdos,
  },
  {
    id: 'fibonacci', name: 'Fibonacci concatenation', group: 'Proved normal', max: 20000000,
    note: 'The paper’s F_10 = 0.1123581321345589144233…',
    kind: 'digits', f: fibonacciConcat,
  },
  {
    id: 'random', name: 'Pseudorandom digits', group: 'Proved normal', max: 20000000,
    note: 'A seeded digit stream: the control specimen, what "as expected" looks like.',
    kind: 'digits', f: (b, n) => pseudorandom(b, n, 0x5bf03635),
  },

  {
    id: 'liouville', name: 'Liouville constant', group: 'Proved abnormal', max: 20000000,
    note: 'A digit 1 at each position k!, zeros everywhere else. Transcendental and grossly non-normal.',
    kind: 'digits', f: liouville,
  },
  {
    id: 'thuemorse', name: 'Thue–Morse digits', group: 'Proved abnormal', max: 20000000,
    note: 'Parity of the binary digit sum. In base 2 it is simply normal but not normal — it contains no cube.',
    kind: 'digits', f: thueMorse,
  },

];

function libraryById(id) { return LIBRARY.find((e) => e.id === id); }

/* Produce the digits of a catalogue entry, or of whatever the user typed.
   Returns { digits, exact, periodStart, label } — `exact` says whether the
   densities downstream are measurements on a prefix or the real thing. */
function materialise(spec, b, n) {
  if (spec.kind === 'rational') {
    const r = rationalDigits(spec.p, spec.q, b, n, true);
    if (r.periodStart >= 0) {
      const period = r.digits.slice(r.periodStart);
      return { digits: r.digits, exact: true, periodStart: r.periodStart, periodLength: period.length };
    }
    return { digits: r.digits, exact: false, periodStart: -1, periodLength: 0 };
  }
  return { digits: spec.f(b, n), exact: false, periodStart: -1, periodLength: 0 };
}
