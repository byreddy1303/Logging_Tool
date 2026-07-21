import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PinInput from '@/components/auth/PinInput';

describe('PinInput', () => {
  it('requests a numeric phone keyboard while preserving one-character cells', () => {
    render(<PinInput value="" onChange={() => undefined} />);

    const cells = screen.getAllByRole('textbox');
    expect(cells).toHaveLength(6);
    for (const cell of cells) {
      expect(cell).toHaveAttribute('type', 'text');
      expect(cell).toHaveAttribute('inputmode', 'numeric');
      expect(cell).toHaveAttribute('pattern', '[0-9]*');
      expect(cell).toHaveAttribute('maxlength', '1');
    }
  });

  it('strips non-digits before changing the PIN', () => {
    const onChange = vi.fn();
    render(<PinInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('PIN digit 1'), { target: { value: 'a7' } });
    expect(onChange).toHaveBeenCalledWith('7');
  });
});
