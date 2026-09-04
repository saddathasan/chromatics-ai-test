/**
 * The manual: what this system is, how to work it, and why it is built the way it is.
 *
 * It lives in the app rather than in a markdown file because the person who needs it is
 * standing in front of the dashboard, and because it can render the real components - the lane
 * table below shows actual StatusMarks, so it cannot quietly describe a screen that has moved on.
 * Every glossary term is anchored here as `#term-<key>`, which is where the tooltips link.
 * Router-free like the rest of the feature components, so it renders in a test without one -
 * navigation between here and the dashboard belongs to the app bar.
 */
import { StatusMark } from '../dashboard/StatusMark';
import { GLOSSARY, GUIDE_SECTIONS, type TermKey } from '../../lib/glossary';
import type { Lane } from '../../domain/types';

const H2 = 'mt-12 mb-3 border-b border-rule-strong pb-1 text-xl font-semibold';
const H3 = 'mt-6 mb-1.5 text-[15px] font-semibold';
const P = 'my-2.5 max-w-[68ch] text-[15px]/[1.6]';

/**
 * One term, with the anchor its tooltip points at. Paragraphs come from the glossary, so the
 * tip and the passage can never disagree about what a word means.
 */
function Term({ k }: { k: TermKey }) {
  const term = GLOSSARY[k];
  return (
    <div id={`term-${k}`} className="scroll-mt-6 border-t border-rule py-4 first:border-t-0">
      <h3 className="mb-1 text-[15px] font-semibold first-letter:uppercase">{term.label}</h3>
      {term.full.map((paragraph, i) => (
        <p key={i} className={P}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

const LANES: { lane: Lane; when: string }[] = [
  { lane: 'in_flight', when: 'Queued or processing. Nothing to do but wait.' },
  { lane: 'auto_accepted', when: 'Finished, confident, nothing flagged. Nothing to do.' },
  {
    lane: 'needs_review',
    when: 'A field was uncertain, unreadable or missing — or processing failed in a way that can be retried. A person has to decide.',
  },
  {
    lane: 'recapture',
    when: 'A dead-end failure, or a document a person rejected. The paper has to be scanned again.',
  },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-l-2 border-rule pl-4">
      <h3 className={`${H3} mt-0`}>
        <span className="mr-2 font-mono text-ink-muted">{n}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

const reference = (Object.keys(GLOSSARY) as TermKey[]).filter(
  (k) => GLOSSARY[k].section === 'reference',
);

export function Guide() {
  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-10 px-6 pb-20 lg:flex-row">
      <nav aria-label="Contents" className="pt-8 lg:sticky lg:top-6 lg:h-fit lg:w-56 lg:shrink-0">
        <h2 className="mb-2 text-xs uppercase tracking-[0.06em] text-ink-muted">Contents</h2>
        <ol className="m-0 list-none p-0 text-[13px]/[1.9]">
          {GUIDE_SECTIONS.map((section, i) => (
            <li key={section.id}>
              <span className="mr-2 font-mono text-ink-muted">{i + 1}</span>
              <a href={`#${section.id}`} className="underline underline-offset-2">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 flex-1 pt-8">
        <h1 className="text-3xl font-semibold">How this works</h1>
        <p className={`${P} text-ink-muted`}>
          A guide to the archive digitisation dashboard — what is on screen, how to work it, and the
          reasoning underneath.
        </p>

        {/* ---------------------------------------------------------------- 1 */}
        <section id="overview" className="scroll-mt-6">
          <h2 className={H2}>1 · What this screen is for</h2>
          <p className={P}>
            Alo Relief Trust has roughly 100,000 scanned paper documents — aid enrollment forms,
            medical intake sheets, ID scans and handwritten field notes. A processing pipeline reads
            each one and pulls out structured fields: person name, phone, location, programme, date,
            and the document’s own type.
          </p>
          <p className={P}>
            The operator’s job is <strong>not</strong> to watch documents process. It is to get
            through 100,000 of them and find the ones the pipeline got wrong, before those errors
            enter the record. Everything on the dashboard serves that single job, and any number
            that could not be acted on was removed rather than shown.
          </p>
          <p className={P}>
            The work has three motions, repeated: upload a tranche, watch it drain, clear what got
            flagged.
          </p>
        </section>

        {/* ---------------------------------------------------------------- 2 */}
        <section id="lanes" className="scroll-mt-6">
          <h2 className={H2}>2 · Two status axes, one lane</h2>
          <p className={P}>
            This is the idea that unlocks the rest of the screen. Every document tracks{' '}
            <strong>two independent things</strong>, and almost all confusion comes from treating
            them as one.
          </p>

          <div className="my-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-rule-strong bg-paper-sunk text-left">
                  <th className="px-3 py-2 font-medium">Axis</th>
                  <th className="px-3 py-2 font-medium">Values</th>
                  <th className="px-3 py-2 font-medium">Owned by</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-rule">
                  <td className="px-3 py-2 font-mono text-[13px]">status</td>
                  <td className="px-3 py-2">queued → processing → completed | failed</td>
                  <td className="px-3 py-2">the pipeline</td>
                </tr>
                <tr className="border-b border-rule">
                  <td className="px-3 py-2 font-mono text-[13px]">reviewStatus</td>
                  <td className="px-3 py-2">not required | needs review | confirmed | rejected</td>
                  <td className="px-3 py-2">a person</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={P}>
            They are orthogonal. A document that is <em>completed</em> and{' '}
            <em>needs&nbsp;review</em> is entirely normal: the machine finished, and a human still
            has to look. Showing both as badges put two pills on every row across thirty rows, which
            nobody can read — so the table shows one derived <strong>lane</strong> instead, with the
            raw pair printed underneath in small text so nothing is hidden.
          </p>

          <div className="my-4 flex flex-col gap-3 border-y border-rule py-4">
            {LANES.map(({ lane, when }) => (
              <div key={lane} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="w-40 shrink-0 font-semibold">
                  <StatusMark lane={lane} />
                </span>
                <span className="max-w-[52ch] text-[15px]/[1.5]">{when}</span>
              </div>
            ))}
          </div>

          <p className={P}>
            Each lane is drawn as a mark <em>and</em> a word, never colour alone. The five status
            colours sit within 20% relative luminance of each other by design, so the word is
            load-bearing and can never be dropped to save space.
          </p>

          <Term k="lane" />
        </section>

        {/* ---------------------------------------------------------------- 3 */}
        <section id="tasks" className="scroll-mt-6">
          <h2 className={H2}>3 · How to do the work</h2>
          <p className={P}>Four walkthroughs, in the order you would meet them on a real shift.</p>

          <Step n={1} title="Find what needs attention">
            <p className={P}>
              Click the <strong>Needs review</strong> chip above the table. The table narrows to
              documents a person has to decide on.
            </p>
            <p className={P}>
              Read the small text under each row’s state: it names the field at fault —{' '}
              <em>completed · date unreadable</em> — rather than just repeating “needs review”. That
              tells you what you are about to deal with before you open anything.
            </p>
            <p className={P}>
              The margin mark at the far-left edge repeats the lane glyph, so you can also find
              flagged rows by running an eye down the gutter instead of reading every row. Every
              filter, sort and page lives in the URL, so any view you reach is a link you can send
              to someone.
            </p>
          </Step>

          <Step n={2} title="Review and fix a document">
            <p className={P}>
              Click the file name to open the detail drawer. Fields are ordered{' '}
              <strong>worst-first</strong> — uncertain, then unreadable, then missing — not in the
              order they appear on the form. Turn on <em>Flagged only</em> to hide everything that
              needs no attention.
            </p>
            <p className={P}>
              Each field states its condition in words, with the raw text the pipeline actually read
              shown beneath the normalised value when the two differ. Use <em>Correct&nbsp;…</em> to
              replace a value inline; the field then reads “corrected by a person”.
            </p>
            <p className={P}>
              When the record is right, press <strong>Confirm</strong>. Escape closes the drawer and
              focus returns to the row you came from.
            </p>
          </Step>

          <Step n={3} title="Handle a failure">
            <p className={P}>
              Open a failed document. The panel at the bottom says whether the failure can be
              retried, and why — that is a property of the error itself, not a judgement call.
            </p>
            <p className={P}>
              A timeout or an unavailable OCR service is a fault in the pipeline, not in the paper:
              the scan is intact, so <strong>Retry</strong> is offered and another attempt may
              succeed. An unsupported format or a genuinely unreadable capture is a fault in the
              file: retrying would run the same input through the same code for the same result, so
              Retry is not offered at all. Those documents go to <em>Recapture</em> — someone has to
              scan the paper again.
            </p>
            <p className={P}>
              A button you cannot see is a move the system will not accept. Buttons are absent
              rather than disabled, because a disabled button invites a click that can never work.
            </p>
          </Step>

          <Step n={4} title="Upload a batch">
            <p className={P}>
              Press <strong>Upload documents</strong> in the top bar. Choose files, choose a folder,
              or drop a folder onto the dialog — a dropped folder is walked recursively, and the
              count climbs as it is read.
            </p>
            <p className={P}>
              Before anything is sent you get a validation summary: how many were accepted, and how
              many were refused grouped by reason. Name the batch, then press{' '}
              <strong>Start upload</strong>.
            </p>
            <p className={P}>
              Four files transfer at a time, each getting one retry before it is marked failed.
              Aggregate progress comes first — count, rate, estimate — with the per-file queue
              underneath it, filterable by name and by failure. Files are registered with the server
              in batches as they go, so the dashboard fills <em>during</em> the upload rather than
              jumping at the end.
            </p>
            <p className={P}>
              <strong>Cancel remaining</strong> stops the queue; anything already transferred keeps
              processing. Keep the tab open — closing it stops the upload. When it finishes,{' '}
              <em>View batch</em> takes you to the dashboard filtered to exactly what you just sent.
            </p>
          </Step>

          <p className={`${P} mt-6 text-ink-muted`}>
            Two further tasks — retrying in bulk across a filter, and forcing any state on demand
            from a developer panel — arrive with the next milestone and will be documented here when
            they do.
          </p>
        </section>

        {/* ---------------------------------------------------------------- 4 */}
        <section id="reference" className="scroll-mt-6">
          <h2 className={H2}>4 · Every number and word on screen</h2>
          <p className={P}>
            The same definitions the ⓘ marks show, in full. Anything with a mark beside it on the
            dashboard is here.
          </p>
          <div className="mt-4">
            {reference.map((k) => (
              <Term key={k} k={k} />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- 5 */}
        <section id="architecture" className="scroll-mt-6">
          <h2 className={H2}>5 · How it works underneath</h2>
          <p className={P}>
            This is a frontend prototype. There is no backend anywhere — and that constraint shaped
            more of the build than anything else.
          </p>

          <h3 className={H3}>No server, but a real network boundary</h3>
          <p className={P}>
            A service worker intercepts every <code className="font-mono text-[13px]">fetch</code>{' '}
            in the browser and answers it. The application code makes ordinary HTTP requests through
            one typed client and has no idea it is being served locally, so replacing this with a
            real API means deleting the handler file rather than editing components. The identical
            handlers also serve the test runner in Node, which is why the API tests exercise the
            same contract the screen does.
          </p>

          <h3 className={H3}>100,000 documents from one seed</h3>
          <p className={P}>
            The archive is generated at boot from a seeded pseudo-random generator — around 70
            milliseconds for 100,000 records. Nothing is stored, so the same seed always produces
            the same archive, and a document’s extracted detail is generated lazily from its id only
            when something asks for it.
          </p>

          <h3 className={H3}>The virtual clock: status is computed, never written</h3>
          <p className={P}>
            This is the load-bearing decision. Rather than a scheduler mutating records on a timer,
            every document carries a start offset and a duration, and its status is a{' '}
            <strong>function of the current virtual time</strong>: queued before it starts,
            processing between, and its seeded outcome after.
          </p>
          <p className={P}>
            Three things fall out of that. 100,000 documents advance with zero writes, so nothing
            has to be paged or batched. A reload resumes exactly where it left off instead of
            restarting, because the clock accumulates elapsed time rather than reading from a fixed
            origin. And the speed can be changed without rewriting the past.
          </p>

          <h3 className={H3}>What persists, and what does not</h3>
          <p className={P}>
            Only human decisions, retries and simulation settings are stored — as one debounced blob
            in the browser’s own database. The 100,000 base records are never stored; they are
            regenerated from the seed. The stored record is structurally unable to hold a status or
            a timestamp, which is what stops a retried document being frozen in the state it had
            when it was written.
          </p>

          <h3 className={H3}>Making 100,000 rows respond in single-digit milliseconds</h3>
          <p className={P}>
            Filtering runs over cheap derived state and only the returned page of results is ever
            built into full documents. Doing it the obvious way — materialising every matching
            document and then filtering — cost 65 milliseconds per request on the main thread; this
            costs about 6. At the time of writing: 71 ms to generate the archive, 6 ms for a
            filtered page, 5 ms for batch statistics.
          </p>
        </section>

        {/* ---------------------------------------------------------------- 6 */}
        <section id="decisions" className="scroll-mt-6">
          <h2 className={H2}>6 · Decisions and trade-offs</h2>

          <h3 className={H3}>One lane column, not two badges</h3>
          <p className={P}>
            Superseded the original design. Two pills per row across thirty rows is unreadable, and
            the derived lane already encodes the question an operator actually asks.
          </p>

          <h3 className={H3}>Colour is reserved for state</h3>
          <p className={P}>
            There is no brand accent hue anywhere. Actions are ink on paper, so the only saturated
            colour on the screen is a status — which is what makes a coloured thing meaningful at a
            glance. The palette was computed and verified against contrast ratios rather than chosen
            by eye, in both light and dark schemes.
          </p>

          <h3 className={H3}>Defects in words, never a dash</h3>
          <p className={P}>
            Taken from archival condition-survey practice, where grading an item “good, fair or
            poor” is treated as useless and the specific defect is recorded instead. It is why a
            blank field is never ambiguous between “not on the form”, “we could not read it” and
            “this form type has no such field”.
          </p>

          <h3 className={H3}>Confidence is a minimum, not an average</h3>
          <p className={P}>
            An average lets one badly-read field hide behind five clean ones — and it is the badly
            read field that ends up in the record.
          </p>

          <h3 className={H3}>The platform first, libraries last</h3>
          <p className={P}>
            The detail drawer, the upload dialog and the correction flow are built on the native{' '}
            <code className="font-mono text-[13px]">&lt;dialog&gt;</code> element, which supplies
            the focus trap, the inert background, Escape-to-close and the backdrop. No dialog
            library was added. The upload queue renders only its visible window, but with fixed row
            heights that is about twenty lines rather than a virtualisation dependency.
          </p>
          <p className={P}>
            A charting library, a table library and a component library were all evaluated and cut:
            the chart is one stroked polyline with no axes, the table is server-side for sort,
            filter and paging, and every control on the screen is a native element.
          </p>

          <h3 className={H3}>Known limitations</h3>
          <ul className={`${P} list-disc pl-5`}>
            <li>
              Uploaded documents live in memory only. A reload loses them, and loses an upload queue
              that is still running.
            </li>
            <li>
              There are no accounts and no roles. Masking the phone number in the table is a
              sensible default, not a permission boundary.
            </li>
            <li>
              The sparkline is measured in this browser tab and resets on reload; there is no
              history endpoint behind it.
            </li>
            <li>
              Processing outcomes are seeded rather than real. Nothing here performs OCR — the point
              is the operator’s workflow around a pipeline, not the pipeline.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
