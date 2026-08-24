import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import RunPanel from './RunPanel';

afterEach(() => cleanup());

const props = {
  country: 'netherlands',
  base: 'http://localhost:4326',
  state: 'idle' as const,
  hasPoint: true,
  onCountry: () => {},
  onConnect: () => {},
  onClose: () => {},
};

describe('RunPanel', () => {
  test('a click on the map is answered about that point', () => {
    render(<RunPanel {...props} />);
    expect(screen.getByRole('heading').textContent).toMatch(/this point/i);
  });

  // The corner button opens the same panel with nothing picked. A heading that
  // still says "this point" sends the visitor looking for a point they never
  // chose.
  test('the corner button is answered without inventing a point', () => {
    render(<RunPanel {...props} hasPoint={false} />);
    const heading = screen.getByRole('heading').textContent!;
    expect(heading).not.toMatch(/this point/i);
    expect(heading).toMatch(/your own map/i);
  });

  test('names the address it will reach before connect is pressed', () => {
    render(<RunPanel {...props} />);
    expect(screen.getByText(/connects to localhost:4326/i)).toBeTruthy();
  });

  test('the named address gives way to the field that replaces it', () => {
    render(<RunPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /another address/i }));
    expect(screen.queryByText(/connects to localhost:4326/i)).toBeNull();
    expect(screen.getByLabelText(/container address/i)).toBeTruthy();
  });

  // The wait is minutes, and it happens before anything on this page can react
  // to it. Said after the fact - as a failed probe - it reads as a broken page.
  test('says the image has to arrive first', () => {
    render(<RunPanel {...props} />);
    expect(screen.getByText(/first pull/i)).toBeTruthy();
  });

  test('shows the command for the playing country', () => {
    render(<RunPanel {...props} />);
    expect(
      screen.getByText(/docker run -p 4326:4326 ghcr\.io\/roma8ok\/getmapstack\//),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /netherlands/i })).toBeTruthy();
  });

  test('copies exactly what it shows', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<RunPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(
      'docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/netherlands',
    );
    vi.unstubAllGlobals();
  });

  test('connects with the default address', () => {
    const onConnect = vi.fn();
    render(<RunPanel {...props} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    expect(onConnect).toHaveBeenCalledWith('http://localhost:4326');
  });

  test('another address reveals an input that feeds connect', () => {
    const onConnect = vi.fn();
    render(<RunPanel {...props} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: /another address/i }));
    fireEvent.change(screen.getByLabelText(/container address/i), {
      target: { value: 'localhost:4327' },
    });
    fireEvent.click(screen.getByRole('button', { name: /i started it/i }));
    expect(onConnect).toHaveBeenCalledWith('http://localhost:4327');
  });

  test('probing explains the silent permission prompt', () => {
    render(<RunPanel {...props} state="probing" />);
    expect(screen.getByText(/permission/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /i started it/i }).hasAttribute('disabled')).toBe(true);
  });

  test('an error shows the reason and lets you retry', () => {
    render(<RunPanel {...props} state="error" detail="the request failed before reaching anything" />);
    expect(screen.getByText(/failed before reaching anything/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /i started it/i }).hasAttribute('disabled')).toBe(false);
  });

  test('closes', () => {
    const onClose = vi.fn();
    render(<RunPanel {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('is a labelled modal dialog that takes focus', () => {
    render(<RunPanel {...props} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading').id);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));
  });

  test('escape closes the country list first and the panel second', () => {
    const onClose = vi.fn();
    render(<RunPanel {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /netherlands/i }));
    expect(screen.getByRole('searchbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the dimmed area closes, the card itself does not', () => {
    const onClose = vi.fn();
    const { container } = render(<RunPanel {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('heading'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.run')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
