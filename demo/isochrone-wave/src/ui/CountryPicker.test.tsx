import { afterEach, describe, expect, test, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CountryPicker from './CountryPicker';
import { COUNTRIES as ALL } from '../lib/countries';

afterEach(() => cleanup());

// The list's open state belongs to the panel around it - Escape has to close
// the list before it closes the panel, and only the owner of both can order
// that. The harness plays the panel's part.
function Picker({ value, onChange }: { value: string; onChange?: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <CountryPicker value={value} onChange={onChange ?? (() => {})} open={open} onOpenChange={setOpen} />
  );
}

describe('CountryPicker', () => {
  test('shows the selected country and the catalog size', () => {
    render(<Picker value="netherlands" />);
    expect(screen.getByRole('button', { name: /netherlands/i })).toBeTruthy();
    // Derived from the catalog, not written out: a hard-coded count turns every
    // country addition into a failing test that says nothing about the picker.
    expect(screen.getByText(new RegExp(`${ALL.length} countries`))).toBeTruthy();
  });

  test('filters by typed text and reports the chosen slug', () => {
    const onChange = vi.fn();
    render(<Picker value="netherlands" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /netherlands/i }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ken' } });
    fireEvent.click(screen.getByRole('option', { name: /kenya/i }));
    expect(onChange).toHaveBeenCalledWith('kenya');
  });

  // The list scrolls, so every country in the catalog has to be in it: a
  // truncated list looks like a scroll that stops early, with no way to reach
  // the rest but guessing the name.
  test('offers the whole catalog, not a first page of it', () => {
    render(<Picker value="cyprus" />);
    fireEvent.click(screen.getByRole('button', { name: /cyprus/i }));
    expect(screen.getAllByRole('option').length).toBe(ALL.length);
  });

  test('says so when nothing matches', () => {
    render(<Picker value="cyprus" />);
    fireEvent.click(screen.getByRole('button', { name: /cyprus/i }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'atlantis' } });
    expect(screen.getByText(/no country matches/i)).toBeTruthy();
  });

  // A listbox owns its options: an <li> with a role of its own between the two
  // breaks that structure for a screen reader, on the page's conversion path.
  test('the listbox owns its options', () => {
    render(<Picker value="cyprus" />);
    fireEvent.click(screen.getByRole('button', { name: /cyprus/i }));
    const list = screen.getByRole('listbox');
    expect(list.children.length).toBeGreaterThan(0);
    for (const li of Array.from(list.children)) expect(li.getAttribute('role')).toBe('presentation');
    expect(screen.getAllByRole('option').length).toBe(list.children.length);
  });
});
