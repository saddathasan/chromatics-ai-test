/**
 * Every term the interface uses, defined once. The tooltips render `short`, the guide renders
 * `full` under an anchor the tooltips link to, so a definition can never say two things in two
 * places. Same reason `labels.ts` exists: three components each carrying their own copy of a
 * word is how a table and a drawer end up disagreeing.
 */

/** The guide's sections, in reading order. A term must be filed under one of these. */
export const GUIDE_SECTIONS = [
  { id: 'overview', title: 'What this screen is for' },
  { id: 'lanes', title: 'Two status axes, one lane' },
  { id: 'tasks', title: 'How to do the work' },
  { id: 'reference', title: 'Every number and word on screen' },
  { id: 'architecture', title: 'How it works underneath' },
  { id: 'decisions', title: 'Decisions and trade-offs' },
] as const;

export type SectionId = (typeof GUIDE_SECTIONS)[number]['id'];

export type Term = {
  /** The term as a person would say it, used for the tooltip's accessible name. */
  label: string;
  /** One or two sentences. A tooltip is a glance; anything longer belongs in `full`. */
  short: string;
  /** The passage in the guide, one string per paragraph. */
  full: string[];
  section: SectionId;
};

export const GLOSSARY = {
  processed: {
    label: 'the processed count',
    short:
      'Documents the pipeline has finished with — completed plus failed — against everything in the archive. The total grows when you upload.',
    full: [
      'The headline counts documents the pipeline has finished with, successfully or not, against every document it knows about. A failed document is finished: the pipeline is not going to do anything more with it on its own.',
      'The denominator grows when you upload a batch, so the fraction can move backwards. That is the archive getting bigger, not work being undone.',
    ],
    section: 'reference',
  },

  throughput: {
    label: 'throughput',
    short:
      'Documents finishing per second right now, summed across every batch. Divided into the backlog, this is what produces the estimate beside it.',
    full: [
      'Documents finishing per second, summed across every batch that is still moving. It is a current rate, not an average over the run.',
      'It drops to zero the moment nothing is in flight, which is also when the feed indicator goes from Live to Idle.',
    ],
    section: 'reference',
  },

  eta: {
    label: 'the remaining estimate',
    short:
      'Everything queued or processing, divided by the current throughput. It swings sharply just after an upload, because a new batch has no throughput of its own yet.',
    full: [
      'The backlog — queued plus processing — divided by the throughput beside it. It is arithmetic on two live numbers, not a prediction.',
      'Expect it to jump right after an upload. A batch created a second ago has finished nothing, so it contributes documents to the backlog while contributing nothing to the rate. It settles within a poll or two as its first documents complete.',
      'When nothing is in flight it says so rather than showing a zero, because "0 s remaining" and "nothing left to do" are different claims.',
    ],
    section: 'reference',
  },

  sparkline: {
    label: 'the last-updates trace',
    short:
      'How many documents completed between each poll, for the last two dozen polls. It is this browser session’s own observation and resets on reload.',
    full: [
      'Each point is the number of documents that completed between one poll and the next. It answers one question — is throughput holding, or stalling — and deliberately has no axes, no fill and no tooltip of its own.',
      'It is measured in this tab, not fetched. Reloading the page starts the trace again from nothing, because there is no history endpoint behind it.',
    ],
    section: 'reference',
  },

  feed: {
    label: 'the feed indicator',
    short:
      'Live means the dashboard is still polling because documents are queued or processing. Polling stops on its own once nothing is moving.',
    full: [
      'Live means there is something queued or processing, so the dashboard is asking the server for fresh numbers every few seconds. Idle means the archive has drained and polling has stopped.',
      'Stopping matters: a dashboard that polls a finished archive forever burns requests and makes a still screen look broken. Uploading something starts it again.',
      'The timestamp says when the numbers on screen were last answered, not when the page was opened.',
    ],
    section: 'reference',
  },

  chips: {
    label: 'the count chips',
    short:
      'Counts that are also filters. They filter on the raw pipeline and review states, which is why they do not line up one-to-one with the lanes in the table.',
    full: [
      'Every count on this row is a button. A number an operator cannot act on was deleted from the design rather than shown.',
      'They filter on the two axes the API actually has — pipeline status and review status — not on the derived lane. The Needs-review lane is wider than the Needs-review chip: the lane also takes in failures that can be retried, and no single server filter expresses that. So the chip narrows the table, and the lane column tells you what each row actually needs.',
    ],
    section: 'reference',
  },

  lane: {
    label: 'the state column',
    short:
      'One reading of two separate facts — where the pipeline got to, and what a person decided — answering the only question that matters: what do I do with this row?',
    full: [
      'Every document tracks two independent things. The pipeline owns its status: queued, then processing, then completed or failed. A person owns its review status: not required, needs review, confirmed, or rejected. They are orthogonal, and a document that is completed and needs review is entirely normal — the machine finished, and a human still has to look.',
      'Showing both as badges put two pills on every row across thirty rows, which nobody can read. So the column shows one derived lane instead, with the raw pair printed underneath in small text so nothing is hidden.',
      'In flight — queued or processing. Nothing to do but wait.',
      'Auto-accepted — finished, confident, nothing flagged. Nothing to do.',
      'Needs review — a field was uncertain, unreadable or missing, or processing failed in a way that can be retried. A person has to decide.',
      'Recapture — a dead-end failure, or a document a person rejected. The paper itself has to be scanned again.',
      'A retryable failure lands in Needs review rather than with the other failures on purpose: it needs one human click, so it belongs in the attention bucket, not the write-off bucket.',
    ],
    section: 'lanes',
  },

  confidence: {
    label: 'confidence',
    short:
      'The lowest confidence among the fields that carry one. Fields that are missing or unreadable have no score at all, which is why a document can read High and still be flagged.',
    full: [
      'A document’s confidence is the minimum across its extracted fields, not an average. An average lets one badly-read field hide behind five clean ones, and it is the badly-read field that will end up in the record.',
      'The bands are: 0.90 and above is High, 0.70 to 0.89 is Review recommended, below 0.70 is Review required.',
      'Here is the part that looks like a contradiction and is not. A field that is missing or unreadable carries no confidence number — there is nothing to be confident about — so it is excluded from the minimum while still forcing a review. A document can therefore show 0.97 High and sit in the Needs-review lane. That is why a flagged row names the field at fault, "completed · date unreadable", rather than just saying it needs review.',
    ],
    section: 'reference',
  },

  identifier: {
    label: 'the identifier',
    short:
      'The archive’s own id for the document, minted by the server. Uploaded documents get one too; the file name you uploaded stays in the file column.',
    full: [
      'An id the system issues, not anything derived from your file. Documents that arrive by upload are numbered on arrival in the same scheme as the rest of the archive.',
      'Keeping this separate from the file name matters: two districts can both send an intake.pdf, and they are two documents.',
    ],
    section: 'reference',
  },

  marginMark: {
    label: 'the margin mark',
    short:
      'The lane glyph repeated in the gutter at the row’s left edge, so a flagged row can be found by running an eye down the column.',
    full: [
      'The same glyph as the state column, in a narrow gutter at the left edge — where a conservator annotates a register. It is deliberately redundant.',
      'It is how you find flagged rows by scanning the edge rather than reading every row, and it survives the state column being squeezed on a narrow screen. Screen readers skip it and get the word from the state column instead.',
    ],
    section: 'reference',
  },

  maskedPhone: {
    label: 'the masked phone number',
    short:
      'Partly hidden in the table, shown in full in the detail drawer. A list is a glance, often on a shared screen; opening a document is a deliberate act.',
    full: [
      'This archive holds medical intake sheets and ID scans. A phone number sitting in a list view is on screen whenever the dashboard is, including on a projector or a shared desk.',
      'Opening the drawer is a deliberate act by one person, so the full value is shown there. The mask is a default, not a permission boundary — this prototype has no accounts or roles.',
    ],
    section: 'reference',
  },

  fieldStatus: {
    label: 'field status',
    short:
      'Why a field looks the way it does, stated in words. A blank value is never left ambiguous between "not on the form", "we could not read it" and "this form has no such field".',
    full: [
      'Six statuses, each a different fact about the paper, and each written out rather than shown as a score or a dash:',
      'extracted — read cleanly.',
      'uncertain — read, but the pipeline is not confident. This is the dangerous one: there is a value, and it may be wrong.',
      'not present on this form — the field exists on this form type and was left blank.',
      'present, but could not be read — there is ink there and the pipeline could not resolve it. Usually handwriting.',
      'not used on this form type — the form has no such field. Nothing is missing, and no correction is offered, because inviting someone to fill it in is inviting bad data.',
      'corrected by a person — a human replaced the value. It carries their word from then on.',
      'This comes from archival condition-survey practice, where grading an item "good, fair or poor" is treated as useless and the specific defect is recorded instead. It is why these six can never collapse into an em-dash in the interface.',
    ],
    section: 'reference',
  },

  worstFirst: {
    label: 'worst-first ordering',
    short:
      'Fields are ordered by how much trouble they are, not by their order on the form. Uncertain leads, because a value that is present and wrong is the failure this product exists to prevent.',
    full: [
      'The order is: uncertain, then unreadable, then missing, then corrected, then clean, then not-applicable last.',
      'Uncertain leads because an unreadable or missing field is at least obviously empty — someone will notice. A field that was read confidently and read wrong looks exactly like a good one, and goes into the record unchallenged. That is the failure worth putting at the top of the panel.',
      'The "flagged only" toggle hides everything that needs no attention, for working through a queue quickly.',
    ],
    section: 'reference',
  },

  reviewActions: {
    label: 'the review actions',
    short:
      'Confirm, Correct, Reject and Retry — and a button is absent, not disabled, when the move is not legal for this document’s current state.',
    full: [
      'Which buttons exist is read from the same transition table the server enforces, so the interface can never offer a move that would come back as a conflict.',
      'Confirm — accept the extraction as it stands. Offered only where a decision is still open.',
      'Correct — replace a field value inline. The field becomes "corrected by a person".',
      'Reject — this extraction is not usable. The document moves to the Recapture lane.',
      'Retry — send it back through the pipeline. Offered only for failures the error itself says are retryable.',
      'When nothing is offered, the panel says why in words rather than showing four dead buttons.',
    ],
    section: 'reference',
  },

  retryable: {
    label: 'retryable',
    short:
      'Whether another attempt could plausibly succeed. It is a property of the error code, not a guess by whoever is looking at the row.',
    full: [
      'A timeout or an unavailable OCR service is a fault in the pipeline, not in the paper. The scan is intact and another attempt may well succeed, so Retry is offered.',
      'An unsupported format or a genuinely unreadable document is a fault in the file. Retrying runs the same input through the same code for the same result, so Retry is not offered and the document goes to Recapture instead — someone has to scan the paper again.',
      'Each error code carries this flag in one table, so the interface never has to infer it from an error message.',
    ],
    section: 'reference',
  },

  timeline: {
    label: 'the processing timeline',
    short:
      'When this document was uploaded, picked up and finished, with the elapsed time between each step.',
    full: [
      'The named steps a document passed through, with elapsed times, so a slow document can be told apart from a stuck one.',
      'Timestamps come from the simulated clock described under How it works underneath, not from a real pipeline.',
    ],
    section: 'reference',
  },

  uploadRate: {
    label: 'the upload rate',
    short:
      'Files settled per second and the estimate for what is left, updated at most twenty times a second so the numbers stay readable.',
    full: [
      'Aggregate progress comes first and the per-file queue sits underneath it, because at three thousand files the aggregate is the only part anyone can act on.',
      'The counter is throttled to twenty updates a second. Past that a changing number is a blur rather than information.',
    ],
    section: 'reference',
  },

  validation: {
    label: 'the validation summary',
    short:
      'Files are checked before anything is sent, and every refusal is grouped by reason — never a bare count of what was skipped.',
    full: [
      'Four reasons a file is refused: it is not a PDF, JPEG, PNG or TIFF; it is empty; it is larger than 25 MB; or it is already in this upload.',
      'Duplicates are judged on the folder-relative path, its size and its modification time, so the same file dropped twice is caught while two different districts’ intake.pdf are correctly kept apart.',
      '"88 skipped" without a reason is where an operator stops trusting the tool, so the reasons are always one click away and always in words.',
    ],
    section: 'reference',
  },

  queueFailed: {
    label: 'a failed upload row',
    short:
      'The transfer itself failed twice — once, then one retry — so this file never reached the server. It is not a processing failure.',
    full: [
      'Transfers run four at a time and each one gets a single retry before it is marked failed. A file that fails twice is a bad file, and hammering it just hides that.',
      'This is a transport failure, not a pipeline failure: the file never arrived, so it will not appear in the archive at all. Failures like this are worth finding, which is why the queue has a failed-only toggle once any exist.',
    ],
    section: 'reference',
  },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof GLOSSARY;
