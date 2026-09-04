/**
 * The "what is this?" affordance: a small mark beside a label that explains it on hover.
 *
 * Hover is what it is for, but hover alone would lock out every keyboard and touch user, so
 * focus and tap open the same panel (WCAG 2.2 SC 1.4.13, which also requires that it be
 * dismissible and that the pointer be able to travel into it without it vanishing).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY, type TermKey } from '../lib/glossary';

/** Long enough that a pointer crossing the screen does not strobe every tip it passes. */
const OPEN_DELAY = 120;
/** Short enough to feel immediate, long enough to cross the gap into the panel. */
const CLOSE_GRACE = 120;

const WIDTH = 300;
const GAP = 6;

type Anchor = { top: number; left: number };

/**
 * Positioned `fixed` from a measurement taken as it opens, rather than absolutely inside its
 * parent: the table sits in scroll containers, and an absolutely-positioned panel near the
 * right-hand columns would be clipped in half by them.
 */
export function InfoTip({ term }: { term: TermKey }) {
  const entry = GLOSSARY[term];
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const id = useId();

  const show = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    setAnchor({
      top: box.bottom + GAP,
      // Keep it on screen when the trigger sits in a right-hand column.
      left: Math.max(GAP, Math.min(box.left, window.innerWidth - WIDTH - GAP)),
    });
  };

  /**
   * A delay of zero means now, not next tick. Focus and Escape are explicit acts by a person
   * who has already decided; making them wait on a timer is a stutter with nothing to gain.
   * The delay exists only for the pointer, which crosses labels it did not mean to ask about.
   */
  const open = (delay: number) => {
    clearTimeout(timer.current);
    if (delay === 0) show();
    else timer.current = setTimeout(show, delay);
  };

  const close = (delay: number) => {
    clearTimeout(timer.current);
    if (delay === 0) setAnchor(null);
    else timer.current = setTimeout(() => setAnchor(null), delay);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(0);
    };
    // The panel is measured once as it opens, so scrolling would strand it beside nothing.
    const onScroll = () => close(0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor]);

  return (
    <span className="inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-label={`About ${entry.label}`}
        aria-expanded={anchor !== null}
        aria-describedby={anchor ? id : undefined}
        className="c-infotip"
        onMouseEnter={() => open(OPEN_DELAY)}
        onMouseLeave={() => close(CLOSE_GRACE)}
        onFocus={() => open(0)}
        onBlur={() => close(0)}
        onClick={() => (anchor ? close(0) : open(0))}
      >
        <span aria-hidden="true">i</span>
      </button>

      {anchor ? (
        <span
          id={id}
          role="tooltip"
          style={{ top: anchor.top, left: anchor.left, width: WIDTH }}
          className="c-infotip-panel fixed z-50 border border-rule-strong bg-paper p-3 text-left text-[13px]/[1.45] font-normal text-ink"
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => close(CLOSE_GRACE)}
        >
          <strong className="block pb-1 text-[11px] uppercase tracking-[0.06em] text-ink-muted">
            {entry.label}
          </strong>
          {entry.short}{' '}
          <a
            href={`/guide#term-${term}`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap underline underline-offset-2"
          >
            Read more →
          </a>
        </span>
      ) : null}
    </span>
  );
}
