/**
 * The one place a lane becomes something visible. Every status is drawn as a mark *and* a
 * word (WCAG 2.2 SC 1.4.1, Level A) because the five status colours sit within 20% relative
 * luminance of each other by design - see docs/design/direction.md §4. There is no colour
 * fallback underneath the word, so the word can never be dropped for a narrow column.
 */
import type { Lane } from '../../domain/types';

/** Glyphs are distinct in shape, not only in hue, so they survive greyscale and deuteranopia. */
const LANES: Record<Lane, { glyph: string; label: string; className: string }> = {
  in_flight: { glyph: '▸', label: 'In flight', className: 'text-processing' },
  needs_review: { glyph: '!', label: 'Needs review', className: 'text-attention' },
  recapture: { glyph: '✕', label: 'Recapture', className: 'text-failed' },
  auto_accepted: { glyph: '✓', label: 'Auto-accepted', className: 'text-completed' },
};

/**
 * The margin mark: the same glyph again, in a mono gutter at the row's left edge, where a
 * conservator annotates a register. Redundant with the status column by design - it is how a
 * flagged row is found by running an eye down the edge, and it survives a narrow column.
 * Hidden from screen readers, which get the word from StatusMark instead.
 */
export function MarginMark({ lane }: { lane: Lane }) {
  return (
    <td aria-hidden="true" className="c-mark px-0 text-center font-mono text-[11px]">
      {LANES[lane].glyph}
    </td>
  );
}

/** The status column's cell: glyph then word, in that order, always both. */
export function StatusMark({ lane }: { lane: Lane }) {
  const { glyph, label, className } = LANES[lane];
  return (
    <span className={`flex items-baseline gap-1.5 whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className="font-mono font-semibold">
        {glyph}
      </span>
      {label}
    </span>
  );
}
