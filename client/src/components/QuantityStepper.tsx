import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Integer stepper (default 1–99).
 * - Valid typed values (whole numbers in range) are reported to `onChange` as you type.
 * - Anything else ("2.5", "-5", "1e2", "abc", "0", "150", "") is kept exactly as typed, marked
 *   invalid with an inline hint and NEVER turned into another number. While it is invalid, the
 *   reported value goes back to the last valid one (the value before this edit), so a summary
 *   never shows a half-typed number; on blur or Enter the field shows that value again.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'Bundles',
  hideLabel = false,
  size = 'default',
  context,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  hideLabel?: boolean;
  size?: 'default' | 'sm';
  /** Appended to accessible names, e.g. "4 Packs, Vitamin D3" → "Increase bundles for 4 Packs…". */
  context?: string;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState<string>();
  const focused = useRef(false);
  /** Last valid value before the current edit: what an invalid draft falls back to. */
  const lastValid = useRef(value);

  // Follow outside changes (e.g. the cart updated in another tab), but never overwrite what the
  // user is typing.
  useEffect(() => {
    if (!focused.current) {
      setDraft(String(value));
      lastValid.current = value;
    }
  }, [value]);

  const rangeHint = `Whole number from ${min} to ${max}`;
  const suffix = context ? ` for ${context}` : '';
  const parse = (text: string) => {
    if (!/^\d+$/.test(text)) return undefined;
    const n = Number(text);
    return n >= min && n <= max ? n : undefined;
  };
  const parsed = parse(draft);
  const draftValid = parsed !== undefined;
  const current = parsed ?? lastValid.current;

  const report = (n: number) => {
    if (n !== value) onChange(n);
  };

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, current + delta));
    setNotice(undefined);
    setDraft(String(next));
    lastValid.current = next;
    report(next);
  };

  const handleInput = (text: string) => {
    setDraft(text); // never rewrite what was typed
    setNotice(undefined);
    const n = parse(text);
    // Invalid: fall back to the last valid value instead of keeping a half-typed number.
    report(n ?? lastValid.current);
  };

  /** Blur / Enter: accept a valid draft, or show the last valid value again. */
  const settle = () => {
    if (draftValid) {
      lastValid.current = parsed;
      return;
    }
    if (draft.trim() !== '') setNotice(`"${draft}" is not a whole number from ${min} to ${max}`);
    setDraft(String(lastValid.current));
    report(lastValid.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Enter') {
      settle();
    }
  };

  const showError = !draftValid;
  const buttonSize = size === 'sm' ? 'size-9' : 'size-10';

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium', hideLabel && 'sr-only')}>
        {label}
        {suffix}
      </label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={buttonSize}
          onClick={() => step(-1)}
          disabled={current <= min}
          aria-label={`Decrease ${label.toLowerCase()}${suffix}`}
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
          maxLength={8}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            settle();
          }}
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
          disabled={current >= max}
          aria-label={`Increase ${label.toLowerCase()}${suffix}`}
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
