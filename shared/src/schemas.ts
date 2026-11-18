import { z } from 'zod';
import { filsToKwdString, toFils } from './money';

/**
 * Zod schemas shared by the client forms and the API. Error messages are written for end users
 * because the client shows them inline.
 */

/** Largest value a DECIMAL(10,3) column can hold: 9,999,999.999 KWD. */
export const MAX_PRICE_FILS = 9_999_999_999;
export const MAX_UNITS_PER_BUNDLE = 100_000;
export const MAX_IMAGES_PER_PRODUCT = 12;
export const NAME_MAX = { brand: 120, category: 120, product: 200, tierLabel: 60 } as const;
export const DESCRIPTION_MAX = 5000;

const PRICE_RE = /^\d+(\.\d+)?$/;

export const idSchema = z.uuid({ error: 'Invalid id' });

const requiredName = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });

/**
 * Bundle price in KWD (the TOTAL for the bundle). Accepts "19.5", "19.500" or 19.5;
 * outputs a normalised DECIMAL string ("19.500"). Must be > 0 with at most 3 decimals.
 */
export const priceKwdSchema = z
  .union([z.string(), z.number()], { error: 'Price is required' })
  .transform((value, ctx) => {
    const text = typeof value === 'number' ? String(value) : value.trim();
    if (text === '') {
      ctx.addIssue({ code: 'custom', message: 'Price is required' });
      return z.NEVER;
    }
    if (!PRICE_RE.test(text)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid price, e.g. 19.500' });
      return z.NEVER;
    }
    if ((text.split('.')[1] ?? '').length > 3) {
      ctx.addIssue({ code: 'custom', message: 'Price can have at most 3 decimals (fils)' });
      return z.NEVER;
    }
    const fils = toFils(text);
    if (fils <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Price must be greater than 0' });
      return z.NEVER;
    }
    if (fils > MAX_PRICE_FILS) {
      ctx.addIssue({ code: 'custom', message: 'Price is too large' });
      return z.NEVER;
    }
    return filsToKwdString(fils);
  });

export const unitsPerBundleSchema = z
  .number({ error: 'Units must be a whole number' })
  .int({ error: 'Units must be a whole number' })
  .min(1, { error: 'Units must be at least 1' })
  .max(MAX_UNITS_PER_BUNDLE, { error: `Units must be at most ${MAX_UNITS_PER_BUNDLE}` });

export const brandInputSchema = z.object({ name: requiredName('Name', NAME_MAX.brand) });
export const categoryInputSchema = z.object({ name: requiredName('Name', NAME_MAX.category) });

export const tierInputSchema = z.object({
  /** Existing tier id when editing; omitted for new tiers. */
  id: idSchema.optional(),
  label: requiredName('Label', NAME_MAX.tierLabel),
  unitsPerBundle: unitsPerBundleSchema,
  bundlePrice: priceKwdSchema,
});

/** Only images uploaded through the API (served from /uploads) are accepted. */
export const imageUrlSchema = z
  .string()
  .regex(/^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/, { error: 'Invalid image' });

export const productInputSchema = z.object({
  name: requiredName('Name', NAME_MAX.product),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, { error: `Description must be at most ${DESCRIPTION_MAX} characters` })
    .nullish()
    .transform((value) => value || null),
  brandId: z.uuid({ error: 'Select a brand' }),
  categoryId: z.uuid({ error: 'Select a category' }),
  images: z
    .array(imageUrlSchema)
    .max(MAX_IMAGES_PER_PRODUCT, { error: `At most ${MAX_IMAGES_PER_PRODUCT} images` })
    .default([]),
  // Number of tiers is dynamic on purpose: no maximum.
  tiers: z
    .array(tierInputSchema, { error: 'Add at least one pricing tier' })
    .min(1, { error: 'Add at least one pricing tier' })
    .superRefine(
      (tiers, ctx) => {
        const firstIndexByUnits = new Map<number, number>();
        tiers.forEach((tier, index) => {
          // Runs even when other tier fields are invalid (see `when`), so be defensive.
          const units = (tier as { unitsPerBundle?: unknown } | undefined)?.unitsPerBundle;
          if (typeof units !== 'number' || !Number.isInteger(units)) return;
          if (!firstIndexByUnits.has(units)) {
            firstIndexByUnits.set(units, index);
            return;
          }
          ctx.addIssue({
            code: 'custom',
            path: [index, 'unitsPerBundle'],
            message: `Another tier already has ${units} unit(s) per bundle`,
          });
        });
      },
      // Report duplicates together with other errors, not only once everything else is valid.
      { when: (payload) => Array.isArray(payload.value) },
    ),
});

export const productListQuerySchema = z.object({
  brandId: z.uuid({ error: 'Invalid brandId' }).optional(),
  categoryId: z.uuid({ error: 'Invalid categoryId' }).optional(),
});

export type BrandInput = z.infer<typeof brandInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type TierInput = z.infer<typeof tierInputSchema>;
/** What a form produces (before transforms), e.g. price as typed. */
export type ProductFormValues = z.input<typeof productInputSchema>;
/** What the API works with after parsing (price normalised to "19.500"). */
export type ProductInput = z.output<typeof productInputSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
