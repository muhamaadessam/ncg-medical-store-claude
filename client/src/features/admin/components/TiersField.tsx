import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  formatKWD,
  perPackFils,
  priceKwdSchema,
  toFils,
  type ProductFormValues,
} from '@ncg/shared';
import { fieldAria } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** "4.875 KWD per pack" from what is typed so far (integer fils), or a prompt. */
export function perPackHint(price: unknown, units: unknown): string {
  const parsed = priceKwdSchema.safeParse(price);
  if (!parsed.success || !Number.isInteger(units) || (units as number) < 1) {
    return 'Enter units and price to see the per-pack price';
  }
  const fils = toFils(parsed.data);
  if (units === 1) return `${formatKWD(fils)} for 1 pack`;
  return `${formatKWD(perPackFils({ bundlePriceFils: fils, unitsPerBundle: units as number }))} per pack`;
}

export function TiersField({
  control,
  register,
  errors,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
}) {
  // keyName "key": the tier's own `id` (existing tiers) must stay in the form values.
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'tiers',
    keyName: 'key',
  });
  const tiers = useWatch({ control, name: 'tiers' });
  const listError = errors.tiers?.root?.message ?? errors.tiers?.message;

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {fields.map((field, index) => {
          const tierErrors = errors.tiers?.[index];
          const ids = {
            label: `tier-${index}-label`,
            units: `tier-${index}-units`,
            price: `tier-${index}-price`,
          };
          const current = tiers?.[index];
          return (
            <li key={field.key} className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Tier {index + 1}</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move tier ${index + 1} up`}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move tier ${index + 1} down`}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    aria-label={`Remove tier ${index + 1}`}
                    className="hover:text-destructive"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor={ids.label}>Label</Label>
                  <Input
                    {...fieldAria(ids.label, tierErrors?.label?.message)}
                    placeholder="e.g. 4 Packs"
                    {...register(`tiers.${index}.label`)}
                  />
                  <FieldError id={ids.label} message={tierErrors?.label?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={ids.units}>Units per bundle</Label>
                  <Input
                    {...fieldAria(ids.units, tierErrors?.unitsPerBundle?.message)}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="4"
                    {...register(`tiers.${index}.unitsPerBundle`, {
                      setValueAs: (v: unknown) => (v === '' || v == null ? Number.NaN : Number(v)),
                    })}
                  />
                  <FieldError id={ids.units} message={tierErrors?.unitsPerBundle?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={ids.price}>Bundle price (KWD, total)</Label>
                  <Input
                    {...fieldAria(ids.price, tierErrors?.bundlePrice?.message, true)}
                    inputMode="decimal"
                    placeholder="19.500"
                    autoComplete="off"
                    {...register(`tiers.${index}.bundlePrice`)}
                  />
                  {tierErrors?.bundlePrice?.message ? (
                    <FieldError id={ids.price} message={tierErrors.bundlePrice.message} />
                  ) : (
                    <p id={`${ids.price}-hint`} className="text-xs text-muted-foreground">
                      {perPackHint(current?.bundlePrice, current?.unitsPerBundle)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {listError && (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({ label: '', unitsPerBundle: Number.NaN, bundlePrice: '' }, { shouldFocus: true })
        }
      >
        <Plus aria-hidden />
        Add tier
      </Button>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
