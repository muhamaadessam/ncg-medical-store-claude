// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

function Harness({ initial = 5, onChange }: { initial?: number; onChange?: (n: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <QuantityStepper
        value={value}
        onChange={(n) => {
          onChange?.(n);
          setValue(n);
        }}
      />
      <output data-testid="value">{value}</output>
      <button type="button">elsewhere</button>
    </>
  );
}

const input = () => screen.getByRole('textbox', { name: 'Bundles' });
const current = () => screen.getByTestId('value').textContent;

/** Replace the field's text the way a user would (select all, type). */
async function typeInto(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.clear(input());
  if (text) await user.type(input(), text);
}

describe('QuantityStepper', () => {
  it.each(['2.5', '-5', '1e2', 'abc', '0', '150', '500', ''])(
    'keeps %j as typed, marks it invalid, never reports another number, restores on blur',
    async (text) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness initial={5} onChange={onChange} />);

      await typeInto(user, text);

      expect(input()).toHaveValue(text); // not stripped into a different number (2.5 → 25, -5 → 5)
      expect(input()).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Enter a whole number from 1 to 99')).toBeInTheDocument();
      expect(current()).toBe('5'); // the reported value is back to the last valid one
      for (const [n] of onChange.mock.calls) {
        expect(Number.isInteger(n) && n >= 1 && n <= 99).toBe(true);
      }
      expect(onChange).not.toHaveBeenCalledWith(25); // "2.5" must never become 25
      expect(onChange).not.toHaveBeenCalledWith(100); // "1e2"

      await user.click(screen.getByRole('button', { name: 'elsewhere' }));
      expect(input()).toHaveValue('5');
      expect(input()).not.toHaveAttribute('aria-invalid');
      expect(current()).toBe('5');
    },
  );

  it('reports valid whole numbers as they are typed and keeps them on blur', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    await typeInto(user, '12');
    expect(current()).toBe('12');
    await user.tab();
    expect(input()).toHaveValue('12');
    expect(current()).toBe('12');
  });

  it('Enter restores an invalid draft too', async () => {
    const user = userEvent.setup();
    render(<Harness initial={3} />);
    await typeInto(user, '2.5');
    await user.keyboard('{Enter}');
    expect(input()).toHaveValue('3');
    expect(current()).toBe('3');
  });

  it('steps with the buttons and stops at the bounds', async () => {
    const user = userEvent.setup();
    render(<Harness initial={98} />);
    const plus = screen.getByRole('button', { name: 'Increase bundles' });
    await user.click(plus);
    expect(current()).toBe('99');
    expect(plus).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Decrease bundles' }));
    expect(current()).toBe('98');
  });

  it('cannot go below 1 with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} />);
    expect(screen.getByRole('button', { name: 'Decrease bundles' })).toBeDisabled();
    input().focus();
    await user.keyboard('{ArrowDown}');
    expect(current()).toBe('1');
    await user.keyboard('{ArrowUp}');
    expect(current()).toBe('2');
  });

  it('steps from the last valid value while the draft is invalid', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    await typeInto(user, 'abc');
    await user.click(screen.getByRole('button', { name: 'Increase bundles' }));
    expect(input()).toHaveValue('6');
    expect(current()).toBe('6');
  });
});
