import { useMemo, useState } from 'react';
import { COUNTRIES as ALL } from '../lib/countries';

// Open state is the caller's: the panel around this list closes it on Escape
// before it closes itself, and that ordering needs one owner.
export default function CountryPicker({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (slug: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ALL;
    return ALL.filter((c) => c.name.toLowerCase().includes(needle) || c.slug.includes(needle));
  }, [q]);

  return (
    <span className="picker">
      <button className="chip" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        {value}
        {/* A drawn caret, not a glyph: ⌄ sits below the baseline in the mono
            face and crosses the chip's dashed underline. */}
        <svg className="caret" viewBox="0 0 8 5" aria-hidden="true">
          <path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="count">{ALL.length} countries are ready</span>
      {open && (
        <span className="list">
          <input
            type="search"
            autoFocus
            value={q}
            aria-label="Search countries"
            placeholder="type a country"
            onChange={(e) => setQ(e.target.value)}
          />
          {matches.length === 0 ? (
            <span className="empty">No country matches that.</span>
          ) : (
            <ul role="listbox">
              {matches.map((c) => (
                // presentation, so the listbox owns the option buttons directly:
                // an <li> keeping its own list-item role sits between the two and
                // breaks the structure the role expects.
                <li key={c.slug} role="presentation">
                  <button
                    role="option"
                    aria-selected={c.slug === value}
                    onClick={() => {
                      onChange(c.slug);
                      onOpenChange(false);
                      setQ('');
                    }}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </span>
  );
}
