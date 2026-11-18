import { describe, expect, it } from 'vitest';
import { formatKWD, toFils } from './money';

describe('toFils', () => {
  it('converts numbers to integer fils', () => {
    expect(toFils(19.5)).toBe(19500);
    expect(toFils(3.75)).toBe(3750);
    expect(toFils(0)).toBe(0);
    expect(toFils(55)).toBe(55000);
  });

  it('is not fooled by binary floating point', () => {
    expect(toFils(1.005)).toBe(1005);
    expect(toFils(0.1 + 0.2)).toBe(300);
    expect(toFils(4.35)).toBe(4350);
  });

  it('parses DECIMAL strings exactly', () => {
    expect(toFils('19.500')).toBe(19500);
    expect(toFils('1.250')).toBe(1250);
    expect(toFils('55')).toBe(55000);
    expect(toFils('0.001')).toBe(1);
    expect(toFils(' 6.25 ')).toBe(6250);
    expect(toFils('12.')).toBe(12000);
  });

  it('rounds half away from zero beyond 3 decimals', () => {
    expect(toFils('1.0005')).toBe(1001);
    expect(toFils('1.0004')).toBe(1000);
    expect(toFils('-1.0005')).toBe(-1001);
    expect(toFils(-0.0004)).toBe(0);
    expect(Object.is(toFils(-0.0004), -0)).toBe(false);
  });

  it('throws on NaN, Infinity and garbage', () => {
    expect(() => toFils(Number.NaN)).toThrow(TypeError);
    expect(() => toFils(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => toFils('abc')).toThrow(TypeError);
    expect(() => toFils('')).toThrow(TypeError);
    expect(() => toFils('1e3')).toThrow(TypeError);
    expect(() => toFils('1,5')).toThrow(TypeError);
  });
});

describe('formatKWD', () => {
  it('formats with exactly 3 decimals', () => {
    expect(formatKWD(19500)).toBe('19.500 KWD');
    expect(formatKWD(39000)).toBe('39.000 KWD');
    expect(formatKWD(1)).toBe('0.001 KWD');
    expect(formatKWD(0)).toBe('0.000 KWD');
    expect(formatKWD(99500)).toBe('99.500 KWD');
  });

  it('adds thousands separators and handles negatives', () => {
    expect(formatKWD(1234500)).toBe('1,234.500 KWD');
    expect(formatKWD(-1250)).toBe('-1.250 KWD');
  });

  it('rejects non-integer input', () => {
    expect(() => formatKWD(19.5)).toThrow(TypeError);
    expect(() => formatKWD(Number.NaN)).toThrow(TypeError);
  });

  it('round-trips with toFils', () => {
    expect(formatKWD(toFils('19.500') * 2)).toBe('39.000 KWD');
  });
});
