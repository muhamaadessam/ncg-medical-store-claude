/**
 * Money helpers. All arithmetic happens on integer fils (1 KWD = 1000 fils).
 * Floats are only ever touched at the boundary (`toFils`), never for math or display.
 */

export const FILS_PER_KWD = 1000;

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d*))?$/;

/** Round half away from zero, so -1.5 and 1.5 behave symmetrically. */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * Convert a KWD amount (number, or decimal string such as MySQL DECIMAL "19.500") to integer fils.
 * Strings are parsed digit by digit so no binary floating point is involved.
 * Throws on NaN, Infinity, empty or non-numeric input.
 */
export function toFils(kwd: number | string): number {
  if (typeof kwd === 'string') {
    const match = DECIMAL_RE.exec(kwd.trim());
    if (!match) throw new TypeError(`Invalid KWD amount: "${kwd}"`);
    const [, sign, whole = '0', fraction = ''] = match;
    const padded = fraction.padEnd(4, '0');
    let fils = Number(whole) * FILS_PER_KWD + Number(padded.slice(0, 3));
    // Round on the 4th decimal (half away from zero).
    if (Number(padded[3]) >= 5) fils += 1;
    if (!Number.isSafeInteger(fils)) throw new RangeError(`KWD amount out of range: "${kwd}"`);
    return sign === '-' && fils !== 0 ? -fils : fils;
  }

  if (typeof kwd !== 'number' || !Number.isFinite(kwd)) {
    throw new TypeError(`Invalid KWD amount: ${String(kwd)}`);
  }
  const fils = roundHalfAwayFromZero(kwd * FILS_PER_KWD);
  if (!Number.isSafeInteger(fils)) throw new RangeError(`KWD amount out of range: ${kwd}`);
  return fils === 0 ? 0 : fils; // normalise -0
}

/**
 * Format integer fils as KWD with exactly 3 decimals and thousands separators,
 * e.g. 19500 → "19.500 KWD", 1234500 → "1,234.500 KWD".
 * Throws if `fils` is not a safe integer (guards against accidental float math upstream).
 */
export function formatKWD(fils: number): string {
  if (!Number.isSafeInteger(fils)) {
    throw new TypeError(`formatKWD expects integer fils, got ${String(fils)}`);
  }
  const negative = fils < 0;
  const abs = Math.abs(fils);
  const whole = Math.floor(abs / FILS_PER_KWD)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % FILS_PER_KWD).toString().padStart(3, '0');
  return `${negative ? '-' : ''}${whole}.${fraction} KWD`;
}
