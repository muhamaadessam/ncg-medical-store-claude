import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Integer stepper (default 1–99). The text field only ever reports valid integers to `onChange`;
 * while the user types something invalid an inline hint explains the range, and on blur the
 * value snaps back into range. Never throws, never reports NaN.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'Bundles',
  hideLabel = false,
  size = 'default',
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  hideLabel?: boolean;
  size?: 'default' | 'sm';
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState<string>();

  // Follow outside changes (e.g. the same line updated from another tab).
  useEffect(() => setDraft(String(value)), [value]);

  const rangeHint = `Whole number from ${min} to ${max}`;
  const parsed = /^\d+$/.test(draft) ? Number(draft) : NaN;
  const draftValid = Number.isInteger(parsed) && parsed >= min && parsed <= max;

  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
    return clamped;
  };

  const step = (delta: number) => {
    setNotice(undefined);
    commit((draftValid ? parsed : value) + delta);
  };

  const handleInput = (text: string) => {
    // Digits only: letters, signs, dots and exponents are dropped as they are typed.
    const digits = text.replace(/\D/g, '').slice(0, 3);
    setDraft(digits);
    setNotice(undefined);
    const n = Number(digits);
    if (digits !== '' && n >= min && n <= max && n !== value) onChange(n);
  };

  const handleBlur = () => {
    if (draftValid) return;
    const fallback = draft === '' ? value : parsed;
    const clamped = commit(fallback);
    if (draft !== '' && clamped !== parsed) {
      setNotice(`Adjusted to ${clamped} (${clamped === max ? 'maximum' : 'minimum'})`);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Enter') {
      handleBlur();
    }
  };

  const showError = draft !== '' && !draftValid;
  const buttonSize = size === 'sm' ? 'size-9' : 'size-10';

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => step(-1)}
          disabled={value <= min && (draftValid || draft === '')}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus aria-hidden />
        </Button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={showError || undefined}
          aria-describedby={hintId}
          className={cn(
            'w-14 rounded-md border border-input bg-transparent text-center text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            buttonSize.replace('size-', 'h-'),
          )}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => step(1)}
          disabled={value >= max && (draftValid || draft === '')}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          'text-xs',
          showError ? 'text-destructive' : notice ? 'text-amber-700' : 'text-muted-foreground',
          hideLabel && !showError && !notice && 'sr-only',
        )}
      >
        {showError ? `Enter a ${rangeHint.toLowerCase()}` : (notice ?? rangeHint)}
      </p>
    </div>
  );
}
