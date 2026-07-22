/* ABNORMAL — exact integer machinery for the constants.

   Every constant is produced as a single BigInt: the integer part of x·b^n,
   from which the base-b digits are read off directly with toString(b). Working
   at a fixed scale, rather than in floating point, is what makes a digit at
   position 200000 mean anything at all — a double runs out of truth at 17.

   The series are summed by binary splitting rather than term by term. Adding
   terms one at a time costs one full-precision division each, which is
   quadratic overall and puts a ceiling of a few thousand digits on the whole
   site; binary splitting keeps the operands small until the very end and turns
   the same series into a handful of large multiplications. That is the
   difference between 20000 digits and 200000. */

/* Sum_{k=l}^{r-1} prod_{j=l}^{k-1} (a(j)/b(j)), returned as {A, B, T} with the
   sum equal to T/B, A = prod a(j) and B = prod b(j) over the interval. */
function binarySplit(l, r, a, b) {
  if (r - l === 1) {
    const B = b(l);
    return { A: a(l), B, T: B };
  }
  const m = (l + r) >> 1;
  const x = binarySplit(l, m, a, b);
  const y = binarySplit(m, r, a, b);
  return { A: x.A * y.A, B: x.B * y.B, T: x.T * y.B + x.A * y.T };
}

/* Integer square root by Newton's method: quadratic convergence, so even a
   million-bit argument costs about twenty divisions. */
function isqrt(n) {
  if (n < 0n) throw new Error('isqrt of a negative number');
  if (n < 2n) return n;
  // A good starting point matters: bisecting from 1 would take as many steps
  // as there are bits.
  let x = 1n << BigInt(Math.ceil(bitLength(n) / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) break;
    x = y;
  }
  return x;
}

/* Integer k-th root, same idea. Used for the cube roots. */
function iroot(n, k) {
  if (n < 2n) return n;
  const K = BigInt(k);
  let x = 1n << BigInt(Math.ceil(bitLength(n) / k) + 1);
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) break;
    x = y;
  }
  return x;
}

function bitLength(n) {
  if (n === 0n) return 0;
  let len = 0;
  let m = n < 0n ? -n : n;
  // Chop 64 bits at a time; a per-bit loop would be hopeless at this size.
  while (m >= 0x10000000000000000n) { m >>= 64n; len += 64; }
  while (m > 0n) { m >>= 1n; len += 1; }
  return len;
}

/* How many terms of a series in 1/q² are needed to exhaust a given scale. */
function termsFor(S, q) {
  return Math.ceil(bitLength(S) / (2 * Math.log2(q))) + 4;
}

/* arctan(1/q) and artanh(1/q), scaled by S.

   Both are sum_k s^k / ((2k+1) q^(2k+1)) with s = −1 and +1 respectively, so
   they differ only in the sign of the numerator of the term ratio
       t_{k+1}/t_k = s (2k+1) / ((2k+3) q²). */
function atanFamilyScaled(q, S, sign) {
  const Q2 = BigInt(q) * BigInt(q);
  const N = termsFor(S, q);
  const a = (k) => BigInt(sign * (2 * k + 1));
  const b = (k) => BigInt(2 * k + 3) * Q2;
  const { B, T } = binarySplit(0, N, a, b);
  return (S * T) / (BigInt(q) * B);          // the leading term is 1/q
}

function atanInvScaled(q, S) { return atanFamilyScaled(q, S, -1); }
function atanhInvScaled(q, S) { return atanFamilyScaled(q, S, 1); }

/* Machin's formula. Two arctangents, each a single binary split. */
function piScaled(S) {
  return 16n * atanInvScaled(5, S) - 4n * atanInvScaled(239, S);
}

/* e = sum 1/k!, with term ratio 1/(k+1). */
function eScaled(S) {
  let N = 8;
  // k! outgrows the scale very fast; find the cut-off by counting bits.
  let bits = 0;
  const want = bitLength(S) + 8;
  for (let k = 1; bits < want; k++) { bits += Math.log2(k); N = k + 1; }
  const { B, T } = binarySplit(0, N, () => 1n, (k) => BigInt(k + 1));
  return (S * T) / B;
}

/* log 2 = 2·artanh(1/3), an order of magnitude faster than the alternating
   harmonic series and, unlike it, actually summable at this size. */
function ln2Scaled(S) {
  return 2n * atanhInvScaled(3, S);
}

/* Fractional part of a scaled value, as its base-b digit string.
   S must be b^(n+guard); the guard digits are dropped on the way out. */
function scaledToDigits(value, S, b, n) {
  let frac = value % S;
  if (frac < 0n) frac = -frac;
  const total = digitCapacity(S, b);
  let s = frac.toString(b);
  if (s.length < total) s = '0'.repeat(total - s.length) + s;
  return stringToDigits(s.slice(0, n), b);
}

function digitCapacity(S, b) {
  // S is exactly b^m by construction, so its base-b string is 1 followed by m zeros.
  return S.toString(b).length - 1;
}

const DIGIT_VALUE = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < 16; i++) {
    t['0123456789abcdef'.charCodeAt(i)] = i;
    t['0123456789ABCDEF'.charCodeAt(i)] = i;
  }
  return t;
})();

function stringToDigits(s, b) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = DIGIT_VALUE[s.charCodeAt(i)];
  return out;
}

/* The digits of p/q in base b, by long division. Rationals are the one family
   where the answer is not an approximation: the expansion is eventually
   periodic, so if the cycle closes within the budget we return the exact
   period and every density downstream is a fraction, not a measurement. */
function rationalDigits(p, q, b, n, detectPeriod) {
  if (q === 0n) throw new Error('zero denominator');
  const sp = p < 0n ? -p : p;
  const sq = q < 0n ? -q : q;
  let r = sp % sq;
  const B = BigInt(b);
  const seen = detectPeriod ? new Map() : null;
  const digits = [];
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (seen) {
      const prev = seen.get(r);
      if (prev !== undefined) { start = prev; break; }
      seen.set(r, i);
    }
    r *= B;
    digits.push(Number(r / sq));
    r %= sq;
  }
  return { digits: Uint8Array.from(digits), periodStart: start };
}
