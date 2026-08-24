import { describe, expect, test, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MINUTES, MODES } from '../lib/isochrones';
import Dock, { fmtClock } from './Dock';

afterEach(() => cleanup());

test('fmtClock renders sim seconds as mm:ss', () => {
  expect(fmtClock(0)).toBe('00:00');
  expect(fmtClock(270)).toBe('04:30');
  expect(fmtClock(900)).toBe('15:00');
});

describe('Dock', () => {
  test('shows the clock and the titled mode legend', () => {
    render(<Dock tl={{ phase: 'paused', t: 90 }} onPlayPause={() => {}} onScrub={() => {}} />);
    expect(screen.getByText('01:30')).toBeTruthy();
    expect(screen.getByText(`How far in ${MINUTES.length} minutes`)).toBeTruthy();
    for (const m of MODES) {
      // The icon sits in its own span, so the label alone is never a whole node.
      const key = screen.getByText(
        (_, el) => el?.className === 'key' && (el.textContent ?? '').includes(m.label),
      );
      expect(key.textContent).toContain(m.icon);
    }
  });
  test('play button reflects the phase and fires', () => {
    const onPlayPause = vi.fn();
    render(<Dock tl={{ phase: 'playing', t: 0 }} onPlayPause={onPlayPause} onScrub={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPlayPause).toHaveBeenCalled();
  });
  test('scrubbing fires with sim seconds', () => {
    const onScrub = vi.fn();
    render(<Dock tl={{ phase: 'paused', t: 0 }} onPlayPause={() => {}} onScrub={onScrub} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '300' } });
    expect(onScrub).toHaveBeenCalledWith(300);
  });

  test('shows the city row and fires the shuffle', () => {
    const onShuffle = vi.fn();
    render(
      <Dock
        tl={{ phase: 'paused', t: 0 }}
        city={{ name: 'Amsterdam', subtitle: '15 minutes from the centre' }}
        onShuffle={onShuffle}
        onPlayPause={() => {}}
        onScrub={() => {}}
      />,
    );
    expect(screen.getByText('Amsterdam')).toBeTruthy();
    expect(screen.getByText('15 minutes from the centre')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /another city/i }));
    expect(onShuffle).toHaveBeenCalled();
  });

  test('the shuffle can be disabled while a city loads', () => {
    render(
      <Dock
        tl={{ phase: 'loading', t: 0 }}
        city={{ name: 'Seoul', subtitle: 'loading' }}
        onShuffle={() => {}}
        shuffleDisabled
        onPlayPause={() => {}}
        onScrub={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /another city/i }).hasAttribute('disabled')).toBe(true);
  });

  // The recording date used to sit bottom left and was hidden under 640px, so a
  // phone saw a recorded wave with nothing saying it was recorded. In the city
  // row it is off the map and survives every width.
  test('the city row carries the recording date', () => {
    render(
      <Dock
        tl={{ phase: 'paused', t: 0 }}
        city={{ name: 'Amsterdam', subtitle: '15 minutes from the centre', credit: 'recorded 2026-08-14' }}
        onPlayPause={() => {}}
        onScrub={() => {}}
      />,
    );
    expect(screen.getByText('recorded 2026-08-14')).toBeTruthy();
  });

  // Live mode before the first click has no recording to play: play() and
  // scrub() are both no-ops in the idle phase, so a transport bar there is
  // three dead controls where the next step should be.
  test('a hint replaces the transport when there is nothing to play', () => {
    render(
      <Dock
        tl={{ phase: 'idle', t: 0 }}
        hint="click anywhere to compute a 15-minute wave from your container"
        onPlayPause={() => {}}
        onScrub={() => {}}
      />,
    );
    expect(screen.getByText(/click anywhere/i)).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('button', { name: /play/i })).toBeNull();
    expect(screen.queryByText('00:00')).toBeNull();
  });

  test('live mode has no city row', () => {
    render(<Dock tl={{ phase: 'paused', t: 0 }} onPlayPause={() => {}} onScrub={() => {}} />);
    expect(screen.queryByRole('button', { name: /another city/i })).toBeNull();
  });
});
