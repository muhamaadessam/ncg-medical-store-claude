// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { thermometer, vitaminD } from '@/test/fixtures';
import { ProductCard } from './ProductCard';

const renderCard = (product = vitaminD, onAdd = vi.fn()) => {
  render(
    <MemoryRouter>
      <ProductCard product={product} onAdd={onAdd} />
    </MemoryRouter>,
  );
  return onAdd;
};

describe('ProductCard', () => {
  it('shows every tier as a radio option with bundle and per-pack prices', () => {
    renderCard();
    const group = screen.getByRole('radiogroup', { name: /choose a bundle/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/1 Pack.*5\.500 KWD/);
    // The visible card is the <label> around each native radio.
    const options = radios.map((radio) => radio.closest('label')!);
    expect(options[1]).toHaveTextContent('4 Packs');
    expect(options[1]).toHaveTextContent('19.500 KWD');
    expect(options[1]).toHaveTextContent('4.875 KWD / pack');
    expect(options[1]).toHaveTextContent('Save 11%');
    expect(options[2]).toHaveTextContent('Best value');
    expect(options[2]).toHaveTextContent('Best value · save 16%');
    expect(options[0]).toHaveTextContent('Single pack');
    expect(options[2]).toHaveTextContent('4.583 KWD / pack');
  });

  it('selects the first tier by default', () => {
    renderCard();
    expect(screen.getByRole('radio', { name: /1 Pack/ })).toBeChecked();
  });

  it('adds the SELECTED tier', async () => {
    const user = userEvent.setup();
    const onAdd = renderCard();
    await user.click(screen.getByRole('radio', { name: /4 Packs/ }));
    expect(screen.getByRole('radio', { name: /4 Packs/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAdd).toHaveBeenCalledWith(vitaminD, 'tier-4');
  });

  it('supports keyboard selection (arrow keys)', async () => {
    const user = userEvent.setup();
    const onAdd = renderCard();
    await user.tab(); // name link
    await user.tab(); // checked radio of the group
    expect(screen.getByRole('radio', { name: /1 Pack/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /4 Packs/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAdd).toHaveBeenCalledWith(vitaminD, 'tier-4');
  });

  it('shows a plain price for a single tier', async () => {
    const user = userEvent.setup();
    const onAdd = renderCard(thermometer);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText('3.750 KWD')).toBeInTheDocument();
    expect(screen.queryByText(/best value/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAdd).toHaveBeenCalledWith(thermometer, 'thermo-1');
  });

  it('links name to the product page and shows a placeholder without images', () => {
    renderCard(thermometer);
    expect(screen.getByRole('link', { name: 'Digital Thermometer' })).toHaveAttribute(
      'href',
      `/products/${thermometer.id}`,
    );
    // The image link is aria-hidden (it duplicates the name link), so query hidden elements too.
    expect(
      screen.getByRole('img', { name: /image unavailable/i, hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByText('MediCare')).toBeInTheDocument();
    expect(screen.getByText('First Aid')).toBeInTheDocument();
  });
});
