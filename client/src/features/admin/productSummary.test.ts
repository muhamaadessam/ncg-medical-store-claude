import { describe, expect, it } from 'vitest';
import { thermometer, vitaminD } from '@/test/fixtures';
import { matchesSearch, priceRange } from './productSummary';

describe('admin product summary', () => {
  it('shows the bundle price range', () => {
    expect(priceRange(vitaminD)).toBe('5.500 – 55.000 KWD');
    expect(priceRange(thermometer)).toBe('3.750 KWD');
    expect(priceRange({ tiers: [] })).toBe('—');
  });

  it('searches name, brand and category', () => {
    expect(matchesSearch(vitaminD, 'vitamin')).toBe(true);
    expect(matchesSearch(vitaminD, 'MEDICARE')).toBe(true);
    expect(matchesSearch(thermometer, 'first aid')).toBe(true);
    expect(matchesSearch(thermometer, 'omega')).toBe(false);
    expect(matchesSearch(thermometer, '  ')).toBe(true);
  });
});
