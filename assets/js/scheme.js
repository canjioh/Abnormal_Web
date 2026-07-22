/* ABNORMAL — the swap map, the difference, and the Δ_b-scheme.

   This is the whole content of the paper, in about two hundred lines: swap two
   digits throughout an expansion, subtract, and look at what comes out. The
   subtlety is entirely in the borrows, so that is where the comments are. */

/* σ^{i,j}: exchange the digits i and j everywhere in the expansion. */
function swapMap(dig, i, j) {
  const out = new Uint8Array(dig.length);
  for (let k = 0; k < dig.length; k++) {
    const d = dig[k];
    out[k] = d === i ? j : (d === j ? i : d);
  }
  return out;
}

/* |ω − σ^{i,j}(ω)| for a finite prefix.

   Digit-wise subtraction of the larger from the smaller, right to left. Only
   the positions holding i or j differ, and each of those in the subtrahend
   generates a borrow that travels leftwards until it meets a position of the
   other kind — which is exactly why the digits 0 and b−1 turn up in bulk while
   δ, b−δ, δ−1, b−δ−1 turn up with the density of the swapped digits. */
function deltaPrefix(dig, b, i, j) {
  const sw = swapMap(dig, i, j);
  let sign = 0;
  for (let k = 0; k < dig.length; k++) {
    if (dig[k] !== sw[k]) { sign = dig[k] > sw[k] ? 1 : -1; break; }
  }
  if (sign === 0) return null;              // σ fixes ω: the trivial line
  const x = sign > 0 ? dig : sw;
  const y = sign > 0 ? sw : dig;
  const out = new Uint8Array(dig.length);
  let borrow = 0;
  for (let k = dig.length - 1; k >= 0; k--) {
    let t = x[k] - y[k] - borrow;
    if (t < 0) { t += b; borrow = 1; } else borrow = 0;
    out[k] = t;
  }
  return out;
}

/* The same for a purely periodic block, where the answer is exact.

   A period of length L is the integer X read in base b^L, and ω is X/(b^L−1).
   The difference of two such numbers is (X−Y) mod (b^L−1), which is the plain
   subtraction with the borrow off the left end fed back into the right end —
   the classical end-around borrow. No truncation anywhere, so every density
   that follows is a rational number and not an estimate. */
function deltaCyclic(block, b, i, j) {
  const sw = swapMap(block, i, j);
  let sign = 0;
  for (let k = 0; k < block.length; k++) {
    if (block[k] !== sw[k]) { sign = block[k] > sw[k] ? 1 : -1; break; }
  }
  if (sign === 0) return null;
  const x = sign > 0 ? block : sw;
  const y = sign > 0 ? sw : block;
  const L = block.length;
  const out = new Uint8Array(L);
  let borrow = 0;
  for (let k = L - 1; k >= 0; k--) {
    let t = x[k] - y[k] - borrow;
    if (t < 0) { t += b; borrow = 1; } else borrow = 0;
    out[k] = t;
  }
  while (borrow) {                          // end-around borrow
    borrow = 0;
    for (let k = L - 1; k >= 0; k--) {
      let t = out[k] - (k === L - 1 ? 1 : 0) - borrow;
      if (t < 0) { t += b; borrow = 1; } else borrow = 0;
      out[k] = t;
    }
  }
  return out;
}

function digitCounts(arr, b) {
  const c = new Int32Array(b);
  for (let k = 0; k < arr.length; k++) c[arr[k]]++;
  return c;
}

/* The line of the Δ_b-scheme that Definition 4.6 prescribes, in exact units of
   1/(2b). Digits that coincide modulo b have their probabilities summed, which
   is what makes the small bases degenerate: at b = 3 every entry collapses to
   2 units and the whole scheme says nothing but "the three digits are equally
   likely". */
function expectedUnits(b, delta) {
  const e = new Int32Array(b);
  const m = (x) => ((x % b) + b) % b;
  e[m(delta)] += 1;
  e[m(b - delta)] += 1;
  e[m(delta - 1)] += 1;
  e[m(b - delta - 1)] += 1;
  e[m(b - 1)] += b - 2;
  e[0] += b - 2;
  return e;                                  // divide by 2b for a probability
}

function gcd(a, c) { while (c) { const t = a % c; a = c; c = t; } return a; }

/* How many batches the prefix is cut into for the error estimate below. */
function blockCount(n) {
  return Math.max(8, Math.min(40, Math.floor(n / 400)));
}

/* The standard error of a density measured on a prefix, by batch means.

   A plain binomial error would be badly wrong here, and in the one direction
   that matters. The digits 0 and b−1 of Δ are not drawn one at a time: a single
   borrow decides an entire run of them at once, so a prefix of n digits carries
   only about 2n/b independent decisions, and the runs are long-tailed on top of
   that. Cutting the prefix into batches and taking the scatter of the batch
   means measures whatever correlation is actually there, without having to
   model it — which is why π looks like a fraud at four thousand digits if you
   compare it against a binomial yardstick. */
function batchError(blockFreq, K, b) {
  const se = new Float64Array(b);
  for (let h = 0; h < b; h++) {
    let m = 0;
    for (let k = 0; k < K; k++) m += blockFreq[k * b + h];
    m /= K;
    let v = 0;
    for (let k = 0; k < K; k++) { const d = blockFreq[k * b + h] - m; v += d * d; }
    v /= (K - 1);
    se[h] = Math.sqrt(v / K);
  }
  return se;
}

/* The full scheme: one line per unordered pair of distinct digits.

   At twenty million digits and base 16 this is a hundred and twenty passes over
   twenty million entries, which is a minute of arithmetic. A minute during
   which the page is frozen and says nothing is not acceptable, so the loop
   hands control back to the browser between pairs and reports how far along it
   is. The work is identical; only the blocking is gone. */
function buildRow(source, b, exact, i, j, K) {
  const total = source.length;
  const d = exact ? deltaCyclic(source, b, i, j) : deltaPrefix(source, b, i, j);
  const delta = j - i;
  if (d === null) {
    return { i, j, delta, trivial: true, counts: null, freq: null, se: null, expected: expectedUnits(b, delta) };
  }
  const counts = digitCounts(d, b);
  const freq = new Float64Array(b);
  for (let h = 0; h < b; h++) freq[h] = counts[h] / total;

  let se = null;
  if (K) {
    const blockFreq = new Float64Array(K * b);
    const size = Math.floor(total / K);
    for (let k = 0; k < K; k++) {
      const from = k * size;
      const to = k === K - 1 ? total : from + size;
      for (let t = from; t < to; t++) blockFreq[k * b + d[t]]++;
      for (let h = 0; h < b; h++) blockFreq[k * b + h] /= (to - from);
    }
    se = batchError(blockFreq, K, b);
  }
  return { i, j, delta, trivial: false, counts, freq, se, expected: expectedUnits(b, delta), total };
}

function pairsOf(b) {
  const out = [];
  for (let i = 0; i < b; i++) for (let j = i + 1; j < b; j++) out.push([i, j]);
  return out;
}

const yieldToPage = () => new Promise((r) => setTimeout(r, 0));

async function buildSchemeAsync(source, b, exact, onProgress) {
  const rows = [];
  const K = exact ? 0 : blockCount(source.length);
  const pairs = pairsOf(b);
  // one yield per pair once a pair is expensive, otherwise a handful at a time
  const every = source.length > 400000 ? 1 : Math.ceil(24 / b);
  for (let p = 0; p < pairs.length; p++) {
    rows.push(buildRow(source, b, exact, pairs[p][0], pairs[p][1], K));
    if (p % every === every - 1 || p === pairs.length - 1) {
      if (onProgress) onProgress((p + 1) / pairs.length);
      await yieldToPage();
    }
  }
  return rows;
}

/* How far the observed line sits from the prescribed one, and — when the
   number is a rational whose period we hold in full — whether it matches it
   on the nose. Exactness is checked as count·2b = units·L, in integers, so a
   "yes" here is a proof and not a rounding. */
function scoreRow(row, b) {
  if (row.trivial) return { dev: 0, z: 0, exactMatch: true, worst: -1, zs: null };
  let dev = 0, worst = -1, maxZ = 0;
  let exactMatch = true;
  const zs = row.se ? new Float64Array(b) : null;
  for (let h = 0; h < b; h++) {
    const target = row.expected[h] / (2 * b);
    const e = Math.abs(row.freq[h] - target);
    if (e > dev) { dev = e; worst = h; }
    if (row.counts[h] * 2 * b !== row.expected[h] * row.total) exactMatch = false;
    if (zs) {
      // A vanishing error means every batch agreed exactly; that is a match if
      // the value is the prescribed one and an outright failure otherwise —
      // which is the right reading for the digits Lemma 4.3 forbids.
      zs[h] = row.se[h] > 0 ? e / row.se[h] : (e === 0 ? 0 : Infinity);
      if (zs[h] > maxZ) maxZ = zs[h];
    }
  }
  return { dev, z: maxZ, exactMatch, worst, zs };
}

/* Simple normality of the number itself: every digit at density 1/b. */
function digitReport(source, b, exact) {
  const counts = digitCounts(source, b);
  const total = source.length;
  const target = 1 / b;
  let dev = 0;
  let exactMatch = true;
  const freq = new Float64Array(b);
  for (let h = 0; h < b; h++) {
    freq[h] = counts[h] / total;
    dev = Math.max(dev, Math.abs(freq[h] - target));
    if (counts[h] * b !== total) exactMatch = false;
  }

  let se = null, z = 0;
  if (!exact) {
    const K = blockCount(total);
    const blockFreq = new Float64Array(K * b);
    const size = Math.floor(total / K);
    for (let k = 0; k < K; k++) {
      const from = k * size;
      const to = k === K - 1 ? total : from + size;
      for (let t = from; t < to; t++) blockFreq[k * b + source[t]]++;
      for (let h = 0; h < b; h++) blockFreq[k * b + h] /= (to - from);
    }
    se = batchError(blockFreq, K, b);
    for (let h = 0; h < b; h++) {
      const e = Math.abs(freq[h] - target);
      const zh = se[h] > 0 ? e / se[h] : (e === 0 ? 0 : Infinity);
      if (zh > z) z = zh;
    }
  }
  return { counts, freq, total, dev, exactMatch, se, z };
}

/* Pseudonormality asks for two things at once: that the line depend on i and j
   only through δ, and that it be the prescribed line. The first is worth
   reporting separately — Example 4.9 of the paper fails precisely there, with
   the (0,1) and (1,2) lines disagreeing while each looks innocent alone. */
async function analyse(source, b, exact, zmax, onProgress) {
  const digits = digitReport(source, b, exact);
  const rows = await buildSchemeAsync(source, b, exact, onProgress);
  for (const r of rows) r.score = scoreRow(r, b);

  let maxDev = 0, worstRow = null, maxZ = 0, worstZRow = null;
  for (const r of rows) {
    if (r.trivial) continue;
    if (r.score.dev > maxDev) { maxDev = r.score.dev; worstRow = r; }
    if (r.score.z > maxZ) { maxZ = r.score.z; worstZRow = r; }
  }

  // spread within a δ class: how much the lines of equal δ disagree
  const byDelta = new Map();
  for (const r of rows) {
    if (r.trivial) continue;
    if (!byDelta.has(r.delta)) byDelta.set(r.delta, []);
    byDelta.get(r.delta).push(r);
  }
  let spread = 0, spreadDelta = -1;
  for (const [delta, group] of byDelta) {
    for (let h = 0; h < b; h++) {
      let lo = Infinity, hi = -Infinity;
      for (const r of group) { lo = Math.min(lo, r.freq[h]); hi = Math.max(hi, r.freq[h]); }
      if (hi - lo > spread) { spread = hi - lo; spreadDelta = delta; }
    }
  }

  const allExact = exact && rows.every((r) => r.score.exactMatch);
  return {
    digits,
    rows,
    byDelta,
    maxDev,
    worstRow,
    maxZ,
    worstZRow,
    zmax,
    spread,
    spreadDelta,
    exact,
    pseudonormal: exact ? allExact : maxZ <= zmax,
    simplyNormal: exact ? digits.exactMatch : digits.z <= zmax,
  };
}

/* The averaged δ-table, i.e. the scheme in the shape Definition 4.6 states it.
   Meaningful only when the lines of equal δ agree, which is why the spread is
   carried alongside. */
function collapseByDelta(rows, b) {
  const out = [];
  const seen = new Map();
  for (const r of rows) {
    if (r.trivial) continue;
    if (!seen.has(r.delta)) seen.set(r.delta, []);
    seen.get(r.delta).push(r);
  }
  for (const [delta, group] of [...seen.entries()].sort((a, c) => a[0] - c[0])) {
    const freq = new Float64Array(b);
    for (const r of group) for (let h = 0; h < b; h++) freq[h] += r.freq[h] / group.length;
    out.push({ delta, freq, expected: expectedUnits(b, delta), lines: group.length });
  }
  return out;
}
