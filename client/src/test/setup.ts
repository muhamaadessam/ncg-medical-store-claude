import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach } from 'vitest';

// jsdom lacks pointer capture; sonner calls it when a toast is pressed.
if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// jsdom does not implement scrolling (React Router's ScrollRestoration calls it).
if (typeof window !== 'undefined') window.scrollTo = () => {};

// sonner keeps toasts in module state: start every test without leftovers.
beforeEach(() => {
  toast.dismiss();
});

afterEach(() => cleanup());
