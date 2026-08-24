import { MINUTES, MODES } from '../lib/isochrones';
import { DURATION, type TimelineState } from '../lib/timeline';
import { WAVE_COLORS } from '../wave/layers';

export const fmtClock = (t: number): string => {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function Dock({
  tl,
  city,
  hint,
  onPlayPause,
  onScrub,
  onShuffle,
  shuffleDisabled = false,
}: {
  tl: TimelineState;
  city?: { name: string; subtitle: string; credit?: string } | null;
  // Shown instead of the transport when there is no wave to move through.
  hint?: string | null;
  onPlayPause: () => void;
  onScrub: (t: number) => void;
  onShuffle?: () => void;
  shuffleDisabled?: boolean;
}) {
  const playing = tl.phase === 'playing';
  return (
    <div className="dock">
      <div className="tl">
        {city && (
          <div className="city">
            <span className="name">{city.name}</span>
            <span className="sub">{city.subtitle}</span>
            {city.credit && <span className="rec">{city.credit}</span>}
            {onShuffle && (
              <button className="shuffle" onClick={onShuffle} disabled={shuffleDisabled}>
                ↻ another city
              </button>
            )}
          </div>
        )}
        {hint ? (
          <p className="hint">{hint}</p>
        ) : (
          <>
            <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={onPlayPause}>
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="clock">
              {fmtClock(tl.t)}
              <small>of {fmtClock(DURATION)}</small>
            </div>
            <input
              type="range"
              min={0}
              max={DURATION}
              step={1}
              value={tl.t}
              aria-label="Time elapsed"
              aria-valuetext={fmtClock(tl.t)}
              onChange={(e) => onScrub(Number(e.target.value))}
            />
          </>
        )}
        <div className="legend">
          <span className="title">How far in {MINUTES.length} minutes</span>
          {MODES.map((m) => (
            <span className="key" key={m.id} style={{ color: WAVE_COLORS[m.id] }}>
              <span className="icon" aria-hidden="true">{m.icon}</span>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
