/** Demo catalog from the brief. Prices are TOTAL bundle prices in KWD (DECIMAL strings). */

export interface SeedTier {
  label: string;
  unitsPerBundle: number;
  bundlePrice: string;
}

export interface SeedProduct {
  name: string;
  description: string;
  brand: string;
  category: string;
  /** File names inside `server/seed-images`. */
  images: string[];
  tiers: SeedTier[];
}

export const SEED_BRANDS = ['MediCare', 'PharmaPlus'] as const;
export const SEED_CATEGORIES = ['Vitamins & Supplements', 'First Aid'] as const;

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: 'Digital Thermometer',
    description:
      'Fast and accurate digital thermometer with an easy-to-read LCD display, fever alert and memory of the last reading. Suitable for oral, underarm and rectal use.',
    brand: 'MediCare',
    category: 'First Aid',
    images: ['thermometer.jpg'],
    tiers: [{ label: '1 Pack', unitsPerBundle: 1, bundlePrice: '3.750' }],
  },
  {
    name: 'Sterile Gauze Pads (10 pcs)',
    description:
      'Individually wrapped 10 × 10 cm sterile gauze pads for cleaning and dressing minor cuts, scrapes and burns. Soft, highly absorbent and lint-free.',
    brand: 'PharmaPlus',
    category: 'First Aid',
    images: ['gauze.jpg', 'gauze-pad.jpg'],
    tiers: [
      { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '1.250' },
      { label: '4 Packs', unitsPerBundle: 4, bundlePrice: '4.500' },
    ],
  },
  {
    name: 'Vitamin D3 1000 IU (60 caps)',
    description:
      'Daily vitamin D3 (cholecalciferol) 1000 IU softgels to support healthy bones, teeth, muscles and immune function. One capsule a day with a meal.',
    brand: 'MediCare',
    category: 'Vitamins & Supplements',
    images: ['vitd3.jpg', 'vitd3-caps.jpg'],
    tiers: [
      { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '5.500' },
      { label: '4 Packs', unitsPerBundle: 4, bundlePrice: '19.500' },
      { label: '12 Packs', unitsPerBundle: 12, bundlePrice: '55.000' },
    ],
  },
  {
    name: 'Omega-3 Fish Oil (90 softgels)',
    description:
      'Purified fish oil softgels rich in EPA and DHA omega-3 fatty acids to support heart, brain and eye health. Molecularly distilled, no fishy aftertaste.',
    brand: 'PharmaPlus',
    category: 'Vitamins & Supplements',
    images: ['omega3.jpg'],
    tiers: [
      { label: '1 Pack', unitsPerBundle: 1, bundlePrice: '6.250' },
      { label: '3 Packs', unitsPerBundle: 3, bundlePrice: '17.000' },
    ],
  },
];
