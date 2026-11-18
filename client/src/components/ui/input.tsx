import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldClasses =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

// forwardRef: React 18 does not pass `ref` as a prop (react-hook-form's register needs it).
const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(fieldClasses, 'h-10 py-1', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
