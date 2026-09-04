/**
 * The demo controls. Every state this interface can show - a drained archive, a flood of
 * failures, a dead backend - is otherwise reachable only by waiting, and an evaluator has no
 * reason to wait. Collapsed by default, and a native <details> so that costs no state.
 */
import type { SimState } from '../../api/client';

const SPEEDS = [1, 10, 100];
const BTN = 'border border-field px-2.5 py-1 text-[13px]';

export function DevPanel({
  sim,
  onChange,
  onReset,
}: {
  sim: SimState;
  onChange: (next: Partial<SimState>) => void;
  onReset: () => void;
}) {
  return (
    <details className="border-t border-rule">
      <summary className="cursor-pointer py-3 text-[13px] text-ink-muted">
        Demo controls — speed, failures, outage, reset
      </summary>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pb-4 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">Clock</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={sim.speed === speed}
              className={`${BTN} ${sim.speed === speed ? 'border-ink bg-ink text-paper' : ''}`}
              onClick={() => onChange({ speed })}
            >
              ×{speed}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <span className="text-ink-muted">Failure rate</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            // Percent on the control, fraction on the wire: nobody reasons in 0.05.
            value={Math.round(sim.failureRate * 100)}
            onChange={(event) => onChange({ failureRate: Number(event.target.value) / 100 })}
          />
          <span className="w-10 font-mono">{Math.round(sim.failureRate * 100)}%</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sim.outage}
            onChange={(event) => onChange({ outage: event.target.checked })}
          />
          Service outage
        </label>

        <button type="button" className={BTN} onClick={onReset}>
          Reset demo data
        </button>
      </div>
    </details>
  );
}
