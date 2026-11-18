// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

function Harness({ initial = 1, onChange }: { initial?: number; onChange?: (n: number) => void }) {
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

describe('QuantityStepper', () => {
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

  it('cannot go below 1', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Decrease bundles' })).toBeDisabled();
    input().focus();
    await user.keyboard('{ArrowDown}');
    expect(current()).toBe('1');
  });

  it('reports valid typed numbers immediately', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.clear(input());
    await user.type(input(), '12');
    expect(current()).toBe('12');
  });

  it('drops non-digit characters as they are typed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.clear(input());
    await user.type(input(), '-2.5e');
    expect(input()).toHaveValue('25');
    expect(onChange).not.toHaveBeenCalledWith(Number.NaN);
    expect(onChange.mock.calls.every(([n]) => Number.isInteger(n) && n >= 1 && n <= 99)).toBe(true);
  });

  it('shows an inline hint for out-of-range input and clamps on blur', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    await user.clear(input());
    await user.type(input(), '150');
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a whole number from 1 to 99')).toBeInTheDocument();
    expect(current()).toBe('15'); // last valid value while typing; 150 is never reported

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(input()).toHaveValue('99');
    expect(current()).toBe('99');
    expect(screen.getByText('Adjusted to 99 (maximum)')).toBeInTheDocument();
  });

  it('clamps 0 up to 1 and restores an emptied field', async () => {
    const user = userEvent.setup();
    render(<Harness initial={7} />);
    await user.clear(input());
    await user.type(input(), '0');
    await user.tab();
    expect(input()).toHaveValue('1');
    expect(current()).toBe('1');

    await user.clear(input());
    await user.tab();
    expect(input()).toHaveValue('1');
  });
});
