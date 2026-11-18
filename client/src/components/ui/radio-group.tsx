import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card-style radio group built on NATIVE radio inputs: the browser handles arrow keys, focus
 * and checking (no JS timing issues), and screen readers get real radio semantics.
 */
const RadioGroupContext = React.createContext<{
  name: string;
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function RadioGroup({
  value,
  onValueChange,
  name,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Unique per group on the page (native radios are grouped by name). */
  name?: string;
}) {
  const fallbackName = React.useId();
  const context = React.useMemo(
    () => ({ name: name ?? fallbackName, value, onValueChange }),
    [name, fallbackName, value, onValueChange],
  );
  return (
    <RadioGroupContext.Provider value={context}>
      <div
        role="radiogroup"
        data-slot="radio-group"
        className={cn('grid gap-2', className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

/** A whole option card: a <label> wrapping a visually hidden native radio. */
function RadioCard({
  value,
  className,
  children,
  disabled,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const group = React.useContext(RadioGroupContext);
  if (!group) throw new Error('RadioCard must be used inside RadioGroup');
  return (
    <label
      data-slot="radio-card"
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-3 rounded-lg border border-input p-3 text-left text-sm transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
        className,
      )}
    >
      <input
        type="radio"
        name={group.name}
        value={value}
        checked={group.value === value}
        onChange={() => group.onValueChange(value)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input peer-checked:border-primary peer-checked:[&>span]:block"
      >
        <span className="hidden size-2 rounded-full bg-primary" />
      </span>
      {children}
    </label>
  );
}

export { RadioGroup, RadioCard };
