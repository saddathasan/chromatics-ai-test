/**
 * Presentation-only formatting for the numbers an operator reads all day.
 * Kept out of the components so the wording of a duration or a count is decided once.
 */

/** Thousands separators, because six-figure counts are the whole point of this screen. */
export const count = (n: number): string => n.toLocaleString('en-GB');

/**
 * A duration a person can act on. "399" tells an operator nothing about whether to wait;
 * "6 min 39 s" does. Seconds are dropped past an hour, where they are noise.
 */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return s % 60 ? `${minutes} min ${s % 60} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

/** Past this, elapsed time stops being information: "75 h 55 min ago" is arithmetic homework. */
const AS_DATE_AFTER = 24 * 3600;

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * How long ago something happened, then a plain date once elapsed time stops helping.
 * An operator watching a batch drain needs seconds; one looking at last week's upload needs
 * a date, and reading it as a duration means doing the subtraction themselves.
 */
export function ago(iso: string, from: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((from - Date.parse(iso)) / 1000));
  if (seconds < 1) return 'just now';
  if (seconds >= AS_DATE_AFTER) return DATE.format(Date.parse(iso)).replace(' at ', ', ');
  return `${duration(seconds)} ago`;
}

/** Two decimals, so 0.9 and 0.94 line up in the column rather than jumping a character. */
export const confidence = (value: number): string => value.toFixed(2);
