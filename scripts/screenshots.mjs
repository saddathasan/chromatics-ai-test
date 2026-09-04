/**
 * Produces the README's screenshots. Run against a live dev server:
 *
 *   pnpm dev &
 *   node scripts/screenshots.mjs docs/screenshots
 *
 * Light scheme throughout, because that is what the README renders against.
 */
import {
  clickText,
  evaluate,
  finish,
  open,
  scheme,
  send,
  shot,
  sleep,
  waitFor,
} from './drive.mjs';

const files = process.argv.includes('--files') ? [] : null;

await scheme('light');

console.log('dashboard');
await open('/');
await waitFor(`!!document.querySelector('table tbody tr')`, 'rows');
await sleep(800);
await shot('01-dashboard');

console.log('bulk selection');
// Filter to failures first: selecting auto-accepted rows shows the bar refusing to offer a
// retry, which is correct behaviour but the wrong thing to put in a README. The chips read
// "glyph + label + count", so they are matched on a substring rather than exactly.
const chip = (label) =>
  evaluate(
    `(() => { const b = [...document.querySelectorAll('button')]
       .find((b) => b.textContent.includes(${JSON.stringify(label)}));
       if (!b) return false; b.click(); return true; })()`,
  );
if (!(await chip('Failed'))) throw new Error('no Failed chip');
await waitFor(`!!document.querySelector('tbody tr td')`, 'failed rows');
await sleep(900);
await evaluate(
  `document.querySelectorAll('tbody input[type=checkbox]').forEach((c, i) => { if (i < 6) c.click(); })`,
);
await sleep(300);
await shot('02-bulk-selection');
await chip('All');
await waitFor(`!!document.querySelector('tbody tr td')`, 'all rows');
await sleep(700);

console.log('detail drawer');
// A flagged row, so the drawer shows the case the product exists for.
await evaluate(
  `(() => { const row = [...document.querySelectorAll('tbody tr')]
     .find((r) => r.textContent.includes('Needs review')) ?? document.querySelector('tbody tr');
     row.querySelector('td button').click(); })()`,
);
await waitFor(`!!document.querySelector('dialog[open]')`, 'drawer');
await sleep(700);
await shot('03-detail-drawer');
await evaluate(`document.querySelector('dialog[open]')?.close()`);
await sleep(300);

console.log('upload dialog');
await clickText('Upload documents');
await waitFor(`!!document.querySelector('dialog[aria-label="Upload documents"]')`, 'upload');
await sleep(400);
await shot('04-upload-dialog');
await evaluate(`document.querySelector('dialog[open]')?.close()`);

console.log('dev panel');
await sleep(300);
await evaluate(`document.querySelector('details')?.setAttribute('open', '')`);
await evaluate(`document.querySelector('details')?.scrollIntoView({ block: 'end' })`);
await sleep(400);
await shot('05-dev-panel');

console.log('guide');
await open('/guide');
await waitFor(`!!document.getElementById('lanes')`, 'guide');
await sleep(600);
await shot('06-guide');
await evaluate(`document.getElementById('tasks').scrollIntoView()`);
await sleep(400);
await shot('07-guide-walkthroughs');

console.log('dark scheme');
await scheme('dark');
await open('/');
await waitFor(`!!document.querySelector('table tbody tr')`, 'rows');
await sleep(800);
await shot('08-dashboard-dark');

finish();
console.log('done');
