import { useEffect, useRef, useState } from 'react';
import { normalizeBase } from '../lib/target';
import CountryPicker from './CountryPicker';

export default function RunPanel({
  country,
  base,
  state,
  detail,
  hasPoint,
  onCountry,
  onConnect,
  onClose,
}: {
  country: string;
  base: string;
  state: 'idle' | 'probing' | 'error';
  detail?: string;
  // The panel has two doors: a click on the map, which is about the point under
  // the cursor, and the corner button, which is about the whole idea. One
  // heading cannot answer both without naming a point the visitor never picked.
  hasPoint: boolean;
  onCountry: (slug: string) => void;
  onConnect: (base: string) => void;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(base);
  const [showAddress, setShowAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const command = `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/${country}`;

  // A map click opens this over everything else, so it has to behave like the
  // modal it looks like: focus moves in on open and back out on close, and
  // Escape unwinds one layer at a time - the country list first, the panel
  // after it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (listOpen) setListOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [listOpen, onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    // Tapping the dimmed area is the phone reflex for "put this away", so it
    // closes - but only when the dim itself was hit, never a click that started
    // inside the card and bubbled out.
    <div className="run" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="run-title">
        <button className="close" aria-label="Close" ref={closeRef} onClick={onClose}>×</button>
        <h2 id="run-title">
          {hasPoint ? 'This point needs your own container' : 'Run it on your own map'}
        </h2>
        <p>
          Seven cities are recorded here. Your own point takes one command - and then the
          map answers from your machine, not from ours.
        </p>
        <div className="cmd">
          <code>
            docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/
          </code>
          <CountryPicker
            value={country}
            onChange={onCountry}
            open={listOpen}
            onOpenChange={setListOpen}
          />
          <button className="copy" onClick={copy}>{copied ? 'copied' : 'copy'}</button>
        </div>
        <p className="note">
          A country image is a few hundred megabytes: the first pull takes a minute or
          two, and its engines need a few seconds more once it starts.
        </p>
        {showAddress && (
          <input
            aria-label="Container address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        )}
        <div className="row">
          <button
            className="go"
            disabled={state === 'probing'}
            onClick={() => onConnect(normalizeBase(address))}
          >
            I started it - connect
          </button>
          {!showAddress && (
            <>
              {/* Where the button is about to go. Until it is pressed the page
                  has said nothing about the address, and the first mention of
                  one used to be the probe - too late to correct. */}
              <span className="target">connects to {address.replace(/^https?:\/\//i, '')}</span>
              <button className="link" onClick={() => setShowAddress(true)}>another address</button>
            </>
          )}
        </div>
        {state === 'probing' && (
          <p className="warn">
            Probing {address.replace(/^https?:\/\//i, '')}. The browser may ask permission to
            reach your local network - until you allow it, this request waits silently, with
            no error and nothing in the console.
          </p>
        )}
        {state === 'error' && <p className="status error">Could not reach the container: {detail}</p>}
      </div>
    </div>
  );
}
