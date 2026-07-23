# ABNORMAL

**A finite test for an infinite property**

A calculator that runs entirely in the browser. Pick a number, pick a base up to
16 and a length up to 20 million digits, and ABNORMAL builds the swap maps
σ<sup>i,j</sup>, the differences Δ<sub>b</sub><sup>i,j</sup>(ω) = ω −
σ<sup>i,j</sup>(ω), the digit densities and the full Δ<sub>b</sub>-scheme — then
reads it against the scheme every *b*-normal number is forced to have.

No server, no build step, no network at runtime. Open `index.html` and it works.

---

## Why

Normality is a statement about every string of every length in every base, so no
finite computation settles it, and not one of the constants anybody cares about
— π, e, √2, log 2 — has ever been proved normal in a single base.

Pseudonormality is what is left of normality once you insist on being able to
check it. Swap two digits throughout the expansion, subtract, and the borrows
force the result to use at most six digits; if the number is normal, the
densities of those six are determined exactly. That table is finite, so it can
be computed, and every normal number must pass it.

The test is a sieve, not a decision procedure: there are rationals — normal in
no base whatsoever — whose scheme is exactly the prescribed one. Part of the
interest is in seeing how fine a sieve it is.

## What it computes

| Panel | Contents |
|---|---|
| Verdict | simple normality, pseudonormality, largest deviation in σ, spread within a δ class |
| Swap map | the permutation of the alphabet and the three expansions in register: ω, σ<sup>i,j</sup>(ω), Δ |
| Digit densities | measured against 1/*b*, with the expected value ruled on each track |
| Δ-scheme | one line per unordered pair, as a heat map |
| Observed vs prescribed | the scheme collapsed by δ, against the theoretical table |

The whole table is exportable as CSV.

## Numbers included

* **Constants** — π, e, log 2, √2, √3, √5, ∛2, φ. Believed normal, proved
  nothing.
* **Proved normal** — Champernowne in any base, Copeland–Erdős, the Fibonacci
  concatenation, and a seeded pseudorandom stream as a control.
* **Proved abnormal** — Liouville's constant, the Thue–Morse digits.
* **Your own** — any fraction *p*/*q*, or a digit string, optionally read as a
  repeating period. This is the first entry in the menu, because it is the point
  of the page.

The rationals that separate the classes are on the theory page rather than in
the menu — paste them into the custom field to see the separations happen:
`7930067/16843009` in base 4 (pseudonormal, not normal), `3617/265720` in base 3
(pseudonormal, not even simply normal), `5/26` in base 3 (simply normal, not
pseudonormal).

## Honesty about the numbers

Two different things are called a verdict here, and the site never conflates
them.

**Rationals are exact.** The expansion is developed until the period closes, the
subtraction is done with an end-around borrow, and every density is a rational
number. A verdict on a rational is a proof.

**Everything else is a measurement** on a finite prefix. The digits of the
constants are produced with exact integer arithmetic at a fixed scale — series
summed by binary splitting, integer roots by Newton, with guard digits, never
floating point — but a prefix is still a sample.

For those, the error is estimated by **batch means**: the prefix is cut into
batches and the scatter of the batch means gives the standard error. A binomial
error would be badly wrong in the direction that matters, because the digits 0
and *b*−1 of Δ arrive in runs decided by a single borrow — a prefix of *n*
digits carries roughly 2*n*/*b* independent decisions, not *n*. Against a
binomial yardstick every constant looks like a fraud. The verdict is then "no
entry sits further than *z* standard errors from the prescribed value", which is
evidence and never a proof.

Two consequences worth knowing before reading a verdict as a result:

* **Slow convergence is real.** Champernowne and Copeland–Erdős are *proved*
  normal and still fail the test at every prefix length. Champernowne's scheme
  deviation shrinks only like 1/log(N): extrapolating the measured rate, it
  would take on the order of 10^50 digits to enter the passing range — more than
  the atoms in the observable universe. Normal in the limit, unreachable in
  practice. It is the sharpest illustration of why the test can only speak of
  prefixes.
* **Base 2 is degenerate** — pseudonormality and simple normality coincide —
  and **base 3 is exceptional**: the scheme collapses to "the three digits of Δ
  are equally likely", which is strictly weaker than simple normality. The
  counterexample is in the catalogue.

## Design

Colour carries exactly one meaning and never decorates:

* **vermilion** — the measured value sits *above* the prescribed one;
* **indigo** — it sits *below*.

Intensity tracks how far, in standard errors. Because a dichromat cannot be
asked to tell warm from cool, every statement colour makes is repeated in a
second channel — a caret, a rule, a bold face. Nothing here is legible only in
colour.

## Structure

```
index.html          cover
theory.html         the definitions and the results, no calculator
compute.html        the calculator
assets/css/abnormal.css
assets/js/shell.js      masthead, navigation, palette
assets/js/hero.js       the cover figure
assets/js/bignum.js     binary splitting, integer roots, rational expansion
assets/js/library.js    the catalogue and the digit generators
assets/js/scheme.js     swap map, Δ, densities, the scheme, the statistics
assets/js/compute.js    the calculator page
assets/vendor/tex-svg.js  MathJax, vendored — nothing is fetched at runtime
```

## Performance

Everything is synchronous; at the top setting the wait is a couple of seconds.
Measured in Chrome on a laptop:

The digits are produced once and then read *b*(*b*−1)/2 times, so the base costs
as much as the length. A run reports its own progress, pair by pair, and says
beforehand what it is going to cost.

| Run | Time |
|---|---|
| π, base 10, 50 000 digits | ~0.5 s |
| Champernowne, base 4, 20 000 000 digits | ~3 s |
| pseudorandom, base 10, 5 000 000 digits | ~5 s |
| pseudorandom, base 16, 20 000 000 digits | ~1 min |
| 7930067/16843009, base 10, exact over its 65 536-digit period | ~0.1 s |

The caps in the menu are measured, not guessed, and they differ by kind. A digit
generator is linear and hands over twenty million digits in about a second; the
long division for a rational is nearly as fast. The analytic constants are
BigInt-bound and stop at **2 million** digits — a run of tens of seconds that
pauses the tab while it computes; twenty million would be minutes, and
pretending otherwise would only produce a frozen tab.

The series are summed by binary splitting rather than term by term. Adding terms
one at a time is quadratic and puts a ceiling of a few thousand digits on the
whole idea; binary splitting keeps the operands small until the very end. That
is the difference between 20 000 digits and 200 000.

## Source

The definitions, the Δ<sub>b</sub>-scheme and the results implemented here are
those of [*Normal and pseudonormal numbers*](https://arxiv.org/abs/2102.05925),
by Nicolò Cangiotti and Daniele Taufer, arXiv:2102.05925. The calculator is an
independent implementation: it computes the schemes from the definitions, and
contains no stored answers.

## Licence

MIT.
