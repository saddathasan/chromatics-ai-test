# Design direction — Alo Relief Trust archive console

> Milestone 3 deliverable. Produced with the `davinci` method: divergence test → researched
> references → decisions with sources → this brief. **Nothing gets built until this is approved.**
> Spec sections it serves: [[2026-09-04-doc-processing-prototype-design]] §6 (screens), §5 (architecture).

---

## 1. Frame

**Subject.** The internal console Alo Relief Trust's archive team uses to digitise ~100,000 accumulated
field documents — enrollment forms, medical intake sheets, ID scans, handwritten notes. Not a
"document management SaaS": a working instrument for a small team clearing a backlog that is
physically finite and emotionally consequential (these are people's enrollment records).

**Audience.** One to five archive operators, in a session that lasts hours, on a desktop, doing the
same three motions over and over: *upload a tranche → watch it drain → clear what got flagged*.
They are not casual users. They will learn the interface in twenty minutes and then live in it.

**The one job of the dashboard.** Answer, in under two seconds and without a click: **how much is
left, and what needs me right now.** Everything else on the screen is secondary to those two numbers.

**Mode.** `product-UI`. Density, state correctness, and legibility at 100k rows are the whole game.
There is no hero and no brand moment to design.

**Existing constraints read from the repo.** Tailwind 4 (`src/index.css` is a bare `@import
"tailwindcss"` — no tokens defined yet, so the palette below is a green field). shadcn is initialised
but has no theme (`components.json` is empty — deferred to M4 per the M1 deviation log). The domain
is already fixed in `src/domain/types.ts` and must not be redesigned: two orthogonal status axes
(`DocumentStatus`, `ReviewStatus`), a derived `Lane`, six `FieldStatus` values, and a `retryable`
flag that lives on the error code. **The interface has to render that model, not invent another one.**

---

## 2. The default I rejected

Written before any research, on autopilot, as the deny-list for this project. Verbatim:

> **Palette.** Tailwind `zinc` for all neutrals, pure achromatic. `indigo-600` as the primary action.
> Status as `emerald-500` completed / `amber-500` needs review / `red-500` failed / `blue-500`
> processing, each as a `rounded-full bg-emerald-100 text-emerald-700` pill.
>
> **Type.** Inter for everything. `font-semibold` headings, `text-sm text-muted-foreground` for
> secondary text. No tabular figures, so every number column shimmers as it updates.
>
> **Section order.** Sticky top bar with the page title left and an indigo "Upload documents" button
> right → a `grid-cols-4` of KPI cards, each `rounded-2xl border shadow-sm p-6` with a tinted icon
> square in the corner and a big number under a small grey label → a Recharts area chart with a
> purple-to-transparent gradient fill inside another rounded card → a row of shadcn `Select`
> dropdowns → the table wrapped in its own `rounded-xl border` card → a right-hand `Sheet` at its
> default width for the detail view.
>
> **The one decorative move.** A 4px coloured left border on the "Needs review" KPI card, plus a
> tinted icon chip in each card corner, to make the strip look designed.

That is the corpus median for an AI-built admin dashboard. Section 8 checks the final direction
against it line by line.

---

## 3. References

Twenty-one real screens examined via the Mobbin MCP, plus four documentation sources read directly.
Each entry states what is being taken, not that the product is nice.

### Real shipping product UI

| Reference | What is taken |
|---|---|
| [Vanta — Documents: All](https://mobbin.com/screens/d9024cf5-8c64-4b36-a65a-60a5366220e4) | The status column is **glyph + word every time** — a red exclamation with "Needs document", an amber triangle with "Needs update", a green check with "OK". Never a bare dot, never colour alone. This is the single most-copied decision in this brief. Also: the filter row is a line of dropdown pills with a "Clear" text link, not a boxed filter panel. |
| [Slite — Knowledge Management](https://mobbin.com/screens/784fd37d-3429-4f47-b58c-0b6fc0ffed07) | The count tiles at the top (`0 Outdated`, `0 Verification expired`, `0 Empty`) **are the filters** — clicking one scopes the table. This is the pattern that kills my KPI-card default: a number you can act on earns its space; a number you can only read does not. Also: the selection bar docks at the **bottom** of the table, showing "1 selected" beside the actions and the range count. |
| [PandaDoc — All documents](https://mobbin.com/screens/fe19281f-c27e-4481-b36a-a8a4bd48162c) | When rows are selected, the selection bar **replaces the filter row in place** rather than floating over the content — no layout shift, no covered rows. |
| [Midday — Documents](https://mobbin.com/screens/975c0ea4-58a5-442e-bea9-cd42f360fd5d) | A hairline-ruled table with **no card wrapper**, filename as the only coloured text in the row, and a small centred "9 selected · Deselect all" pill. Proof that a table can carry a screen without chrome around it. |
| [Attio — CSV import, "Review values"](https://mobbin.com/screens/743c9394-4846-4d21-a8ab-c9ac8729ce60) | The most directly transferable screen in the set. Rows are grouped under a **"Needs review 3"** heading, and each shows **raw data → mapped value** with an arrow between them and the failure named ("Invalid domain") rather than scored. The left rail marks columns needing attention with an amber dot. This is the detail drawer's field list, already designed by someone who shipped it. |
| [Mistral AI — Document Intelligence](https://mobbin.com/screens/9d1334ff-fc93-4b2a-99b3-f16e2deedd10) | Source page on the left, extracted output on the right, page counter over the source. The verification posture: you cannot check an extraction without the thing it was extracted from in view. |
| [Aboard — document review drawer](https://mobbin.com/screens/d15cd548-a758-4743-8944-99c825340019) | The drawer's anatomy: a full-width status banner at the top of the panel, then a label/value field list, then **Reject / Approve pinned at the bottom edge** so the decision is always reachable without scrolling back. |
| [Elicit — research report status](https://mobbin.com/screens/56927a43-45d0-4e03-b99d-8a247542d415) | The processing timeline as a short checklist of named steps with per-step completion and an elapsed time ("Extract data — Completed in 1:08"). Concrete, not a spinner. |
| [Whop — Bulk upload creatives](https://mobbin.com/screens/80459def-95d4-4909-9e7b-8d47d7807147) | Aggregate first: "Uploading 4 files — 80%" with one bar across the top, then the per-file list beneath it. Completed rows get a check and step back visually instead of disappearing. |
| [PandaDoc — Bulk import](https://mobbin.com/screens/6e7783c1-2ce2-4ba2-832d-bab89ec45f67) | The copy solution to our reload problem, in their words: **"Keep this window open so your bulk import can continue uninterrupted."** Stated as a plain instruction, positioned under the count, before anything goes wrong. |
| [Teachable — Bulk upload](https://mobbin.com/screens/c81d368e-2376-414b-8fa8-c24983c6bd9c) | A **filter field inside the upload queue itself**. Obvious once seen, and mandatory at our scale: a 4,000-file queue you cannot search is a wall. |
| [Gusto — Documents](https://mobbin.com/screens/2a4319d4-c9f9-40df-84ee-3a9023c180bd) · [Docusign — Drafts](https://mobbin.com/screens/22b65fce-9785-448a-9257-b2575ceae1bb) | Corroboration on the status question: both pair a mark with a word. Docusign additionally sets the status glyph in the same column as the word, not in a separate icon gutter. |

### Documentation read directly

| Reference | What is taken |
|---|---|
| [WCAG 2.2 §1.4.1 Use of Color (Level A)](https://www.w3.org/TR/WCAG22/#use-of-color) | Quoted: *"Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element."* Level **A** — the lowest bar there is, and the one a status-badge UI fails most often. |
| [WCAG 2.2 §1.4.11 Non-text Contrast (Level AA)](https://www.w3.org/TR/WCAG22/#non-text-contrast) | Quoted: *"The visual presentation of the following have a contrast ratio of at least 3:1 against adjacent color(s): User Interface Components [and] Graphical Objects."* Drives the separate `field` and `focus` tokens in §4 — the hairline table rules are decorative and exempt, input borders and focus rings are not. |
| [GitHub Primer — Label](https://primer.style/components/label) | Ten semantic label variants (`success`, `attention`, `severe`, `danger`, `done`…), and the definition that a Label is *"a piece of text that is visually stylized"* — text first, styling second. Confirms the semantic-role naming used for our tokens instead of hue names. |
| [Archival Accessioning Best Practices — Accession Record Elements](https://accessioning.gitbook.io/archival-accessioning-best-practices/accession-record-elements) | The non-web source, and the one that changed the design most. See §3.1. |

### 3.1 The non-web source: how archivists already record uncertainty

The archive profession has been solving our exact problem — *record what you received, honestly,
including what you could not determine* — since long before OCR. Two findings changed decisions here:

1. **Naming the defect beats scoring it.** Guidance on collection condition surveys is blunt that
   general grades like "good", "fair" and "poor" are next to useless for formal documentation; what
   gets recorded instead is the specific defect — tears, heavy soil, applied tape, brittle, stained.
   ([Alaska State Library, Condition Reporting](https://lam.alaska.gov/condition-reporting);
   [Indiana Historical Society, Collection Condition Survey](https://indianahistory.org/wp-content/uploads/Collection-Condition-Survey.pdf))
   **A bare `71%` confidence is the OCR equivalent of "fair".** So every flagged field states the
   reason in words — *handwritten, low contrast* / *not present on this form* / *region damaged* —
   and the number rides along as a secondary detail rather than being the whole message.

2. **State the gap, do not conceal it, and do not write "unknown".** The accessioning standard's
   guidance on undetermined information is to *"transparently state circumstances"* and it explicitly
   discourages "unknown" where information is merely pending. This is the argument for our six
   `FieldStatus` values over a single null: `missing` (not on the form), `unreadable` (there, but we
   failed), `not_applicable` (this form has no such field) and `uncertain` (read, low confidence) are
   four different facts about the archive, and collapsing them into an em-dash destroys all four.

3. **The register is the form.** An accession record is a fixed, ordered set of elements — identifier,
   date accessioned, extent, condition description — kept as a ruled register. That is the visual
   idea in §6: this screen is a **register**, not a dashboard.

---

## 4. Palette

**Method.** Built in OKLCH and converted to sRGB with the Ottosson transform, then every pair checked
against the WCAG 2.2 relative-luminance formula — script at
`docs/design/palette.mjs`, re-runnable with `node docs/design/palette.mjs`. Every value below is in
sRGB gamut (two candidates, `processing` and `attention`, were desaturated after the first run
because they clipped; the hexes shown are true renderings of the OKLCH values, not clipped ones).

**The governing rule: colour means state, and nothing else.** There is no brand accent hue in this
interface. Chrome, actions and text are ink on paper; the only saturated colour anywhere on the
screen is a status. This is what makes a flagged row findable in a table of two hundred, and it is
also the reason the primary button is near-black rather than a colour.

**Neutrals are tinted toward the ink hue (250°), not achromatic** — every grey carries 0.004–0.028
chroma of blue-black.

### Light

| Role | OKLCH | Hex | Contrast |
|---|---|---|---|
| `paper` — page ground | `oklch(0.988 0.004 250)` | `#f9fbfe` | — |
| `paper-sunk` — table header, drawer ground | `oklch(0.965 0.006 250)` | `#f0f4f7` | — |
| `rule` — row hairlines | `oklch(0.900 0.010 250)` | `#d9dfe5` | 1.30 on paper *(decorative separator; see note)* |
| `rule-strong` — section rules | `oklch(0.800 0.014 250)` | `#b7bfc7` | 1.79 on paper *(decorative)* |
| `field` — input borders | `oklch(0.650 0.018 250)` | `#87909a` | **3.12** on paper ✓ 1.4.11 |
| `focus` — focus ring | `oklch(0.520 0.105 240)` | `#20709f` | **5.22** on paper ✓ 1.4.11 |
| `ink` — body text, primary button ground | `oklch(0.235 0.028 250)` | `#141f2b` | **16.07** on paper ✓ |
| `ink-muted` — secondary text | `oklch(0.520 0.020 250)` | `#606a74` | **5.32** on paper ✓ · 4.98 on paper-sunk ✓ |
| `queued` | `oklch(0.520 0.020 250)` | `#606a74` | **5.32** ✓ |
| `processing` | `oklch(0.520 0.105 240)` | `#20709f` | **5.22** ✓ · 4.89 on paper-sunk ✓ |
| `completed` | `oklch(0.480 0.110 152)` | `#1f6f3d` | **5.96** ✓ |
| `attention` — needs review | `oklch(0.520 0.105 72)` | `#8e5d11` | **5.44** ✓ |
| `failed` | `oklch(0.520 0.180 25)` | `#ba2b2e` | **5.83** ✓ |

`paper` on `ink` (primary button): **16.07** ✓

### Dark — a second palette, not an inversion

Chroma drops on the large surfaces and lifts on the small status marks; "white" text lands at L 0.93,
not 1.0.

| Role | OKLCH | Hex | Contrast on `d-paper` |
|---|---|---|---|
| `paper` | `oklch(0.190 0.012 250)` | `#101419` | — |
| `paper-sunk` | `oklch(0.230 0.014 250)` | `#181e23` | — |
| `rule` | `oklch(0.320 0.016 250)` | `#2d343b` | 1.47 *(decorative)* |
| `rule-strong` | `oklch(0.420 0.018 250)` | `#464e57` | 2.19 *(decorative)* |
| `field` | `oklch(0.520 0.020 250)` | `#606a74` | **3.35** ✓ 1.4.11 |
| `focus` | `oklch(0.760 0.110 240)` | `#6bbaf0` | **8.72** ✓ |
| `ink` | `oklch(0.930 0.008 250)` | `#e4e8ed` | **15.02** ✓ |
| `ink-muted` | `oklch(0.700 0.014 250)` | `#989fa7` | **6.91** ✓ |
| `queued` | `oklch(0.700 0.014 250)` | `#989fa7` | **6.91** ✓ |
| `processing` | `oklch(0.760 0.110 240)` | `#6bbaf0` | **8.72** ✓ |
| `completed` | `oklch(0.780 0.110 152)` | `#7fcc94` | **9.65** ✓ |
| `attention` | `oklch(0.820 0.120 72)` | `#f4b768` | **10.40** ✓ |
| `failed` | `oklch(0.740 0.130 25)` | `#f28881` | **7.58** ✓ |

`d-paper` on `d-ink` (primary button): **15.02** ✓

**Two honest notes on this palette.**

- *The hairline rules do not reach 3:1 and are not meant to.* SC 1.4.11 covers UI components and
  graphical objects required to understand content. A table row separator is neither: the data is
  carried entirely by text, and the rule is a reading aid. Input borders (`field`) and focus rings
  (`focus`) **are** in scope and both clear 3:1 in both schemes.
- *The five status colours are deliberately near-identical in greyscale* — relative luminance
  0.120–0.145 across all five, a spread of about 20%. They are equal-weight on purpose, so no single
  status shouts over the others in a dense table. **This is precisely why the glyph-and-word rule in
  §6 is load-bearing rather than decorative**: under deuteranopia, or in a greyscale print of a
  screenshot, the colour carries almost nothing and the mark plus the word carries everything. That is
  the correct dependency order, but it means the rule can never be dropped "just this once".

---

## 5. Type

**Faces: IBM Plex Sans + IBM Plex Mono.** One superfamily, one skeleton, shared vertical metrics —
the lowest-risk way to get two voices, per the pairing method. Both **SIL OFL**: free commercial and
web use, self-hostable, no attribution required.

Why this pair rather than the obvious one:

- **It is not Inter, and it is not the escape from Inter.** Plex is a grotesque with humanist
  details, not a geometric sans; it is neither the AI default nor the Space Grotesk / Instrument
  Serif counter-move that has itself become a tell.
- **It was commissioned for technical and industrial documentation** — dense tabular data is the use
  case it was drawn for, not a use case it tolerates.
- **True tabular figures** (`font-variant-numeric: tabular-nums`), applied to every count, percentage,
  file size and timestamp in the interface. In a table that repaints every three seconds while a batch
  drains, proportional figures make the numbers visibly jitter; tabular figures hold the column still.
  This is not a refinement, it is the difference between a live table you can read and one you cannot.
- **Plex Mono carries the identifiers.** Document IDs, batch IDs and file names are set in mono — the
  archival shelfmark convention, and practically, the only way `ALO-2024-EN-04817` and
  `ALO-2024-EN-04B17` are distinguishable at a glance.

**Licence and hosting.** Self-host via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`,
WOFF2, subset to Latin, `font-display: swap`, preload the 400 sans weight only. Never the Google
Fonts CDN: the Munich Regional Court ruling (Jan 2022) makes CDN font loading a GDPR transfer, and an
NGO handling medical intake records across regions is the last client that should carry that exposure.
**This is a dependency install and needs approval at M4.**

**Scale.** 4px base unit. Minor-third at the low end opening to a perfect fourth at the top, so the
scale tightens on a laptop and opens on a large monitor.

| Token | Size | Line-height | Use |
|---|---|---|---|
| `display` | `clamp(24px, 2.2vw, 32px)` | 1.2 | The one headline number ("81,204 of 100,000") |
| `heading` | 18px | 1.35 | Drawer title, dialog title |
| `body` | 14px | 1.45 | Table cells, field values, everything default |
| `label` | 12px | 1.35 | Column headers, field labels — uppercase, 0.06em tracked |
| `micro` | 11px | 1.4 | Timestamps, secondary raw values, byte counts |

14px body sits under Butterick's 15–25px range, deliberately: that range is for prose at a 45–90
character measure. This is a data grid where the "measure" is a 24-character filename cell, and 14px
is the density these operators need to see thirty rows without scrolling. Prose in the interface —
error explanations, empty states, the upload warning — is set at 15px.

---

## 6. Layout and motion

### The structural idea: a register, not a dashboard

The archive team's mental model is already a register — a ruled book where each row is one item and
each column is one recorded fact. The interface adopts that literally:

- **No card wraps the table.** The table sits directly on the page, separated by hairline `rule`
  lines and space. No rounded container, no shadow, no border around the data. (Midday.)
- **No KPI cards.** The stats strip is a single ruled row of counts, and **every count is a filter
  button** that writes to the URL. `Needs review 1,204` is not a metric, it is the way you get to the
  1,204. A number that can only be read gets deleted. (Slite.)
- **Columns are fixed-width and left-ruled**, figures tabular, identifiers mono. The eye tracks down a
  column, which is what a register is for.
- The chart stays — one small `completed over time` sparkline area in the stats row, no gradient
  fill, `rule-strong` stroke, no card. It answers "is throughput holding?" and nothing else.

### The three screens

**Dashboard `/`** — top ruled row: the headline count in `display` on the left, the live indicator and
throughput/ETA on the right. Second ruled row: the count-filters (`All · In flight · Needs review ·
Recapture · Auto-accepted`), each showing its number, the active one marked by an ink underline and
`aria-pressed`. Third row: search field, then type and batch dropdown pills, then a "Clear" text link
(Vanta). Then the register itself, sticky header, thirty rows to a page. **When rows are selected the
filter row is replaced in place by the selection bar** — "12 selected · Retry 12 · Retry all 4,821
matching this filter · Clear" — no floating overlay, no layout shift, nothing covered (PandaDoc).

*Status column, the load-bearing decision.* Our domain has **two** orthogonal axes and rendering both
as badges gives every row two pills, which is badge soup at thirty rows. The proposal: the primary
status column shows the derived **`lane`** — the thing an operator actually acts on (`In flight`,
`Needs review`, `Recapture`, `Auto-accepted`) — as glyph + word, and the raw `status`/`reviewStatus`
pair is shown quietly beneath it in `micro` text ("failed · timeout · retryable"). The full two-axis
truth stays visible in the drawer header. **This is a product decision, not just a visual one — it is
flagged in §9 for your call, because spec §6.1 currently describes two badges.**

*Every status renders as `<glyph> <word>`, always, in that order* (Vanta, Gusto, Docusign; WCAG 2.2
§1.4.1 Level A). The glyphs are distinct in **shape**, not just colour: `▸` in flight, `!` needs
review, `✕` recapture, `✓` auto-accepted. Removing the word is never an option, including in the
narrowest column.

**Detail drawer `/?doc=:id`** — right panel, 520px, over a scrim, with a status banner across the top
of the panel and **Confirm / Correct / Reject / Retry pinned to the bottom edge** (Aboard). Retry is
absent, not disabled, when the error is not retryable — a disabled button invites a click that will
never work. The field list is grouped **"Needs review (3)" first, then the rest** (Attio), and each
flagged row reads:

```
PHONE                                    uncertain · 71%
+880 17•• ••• 402                        ← handwritten, low contrast
raw: "0১৭ ৩২ ৪৪ ৪০২"
```

The reason in words, the raw beside the normalized value with the arrow between them (Attio), the
number last. `missing`, `unreadable`, `not_applicable` and `corrected` each get their own wording —
never an em-dash. A processing timeline of named steps with elapsed times sits below the fields
(Elicit).

**Upload dialog** — drop zone, then Choose files / Choose folder. After selection: a validation
summary line ("3,412 accepted · 88 skipped — see why"), then **the aggregate bar and rate first**
("Uploading 412 of 3,412 · 34/s · about 1 min 20 s left"), then the virtualized per-file queue
underneath with its own filter field (Whop for the order, Teachable for the filter). The reload
warning is stated up front in plain words, borrowed almost directly from PandaDoc: *"Keep this tab
open — uploading stops if you close it. Anything already uploaded keeps processing."*

### Motion

Three jobs only — causality, status feedback, orientation — and everything else is cut.

- Drawer: 200ms slide from the right edge with the row it came from staying highlighted, so the panel
  visibly comes *from* the row.
- Status change in a live row: a 400ms background wash on the changed cell, no movement. Rows never
  reorder under the cursor while a batch drains; new matches land on the next explicit refresh.
- The live indicator is a 1.5s opacity pulse, not a spinner.
- Everything discretionary sits behind `@media (prefers-reduced-motion: no-preference)`; the reduced
  path keeps the colour change and drops the movement.
- No fade-in-on-scroll. Nothing animates on load.

---

## 7. Signature

**The margin mark.**

Every row in the register carries a two-character mark in a fixed mono gutter at its left edge, set in
`ink` at `micro` size — the place and the manner in which a conservator annotates a register:

```
 ·  ALO-2024-EN-04817   enrollment_0417.jpg    ▸ In flight
 !  ALO-2024-MI-04818   intake_scan_88.pdf     ! Needs review    3 fields
 ✕  ALO-2024-ID-04819   id_back_0092.jpg       ✕ Recapture       unsupported format
 ✓  ALO-2024-HW-04820   note_field_0031.jpg    ✓ Auto-accepted   0.94
```

It is redundant with the status column by design — that redundancy is the accessibility mechanism —
and it does the thing a margin mark does in a real register: it lets you find every flagged item by
running a finger down the left edge without reading a single word. It also survives a greyscale
screenshot, deuteranopia, and a 4-inch-wide column, which the colour does not.

That is the only expressive move in the interface. Everything else is quiet: no gradients, no
shadows, no rounded containers, no brand hue, no decorative icon anywhere on the screen.

---

## 8. How this escapes the default

Checked against §2, line by line.

| Axis | Autopilot default | This direction | Escaped? |
|---|---|---|---|
| Primary hue | `indigo-600` | No brand accent hue exists. Actions are `ink` `#141f2b`. Saturated colour is reserved exclusively for state. | ✅ |
| Neutrals | Pure achromatic `zinc` | Tinted to 250° blue-black, 0.004–0.028 chroma throughout | ✅ |
| Type | Inter, no pairing, no tabular figures | IBM Plex Sans + Plex Mono superfamily, tabular figures mandatory, mono identifiers | ✅ |
| Stats | Four `rounded-2xl shadow-sm` KPI cards with tinted icon chips | One ruled row where every count is a filter button; no cards, no icons | ✅ |
| Chart | Recharts area with a purple gradient fill, in a card | One `rule-strong` stroke sparkline, no fill, no card | ✅ |
| Table | Wrapped in `rounded-xl border` card, `rounded-full` pills | Bare ruled register, no container; status as glyph + word, not a pill | ✅ |
| Drawer | shadcn `Sheet` at defaults | 520px panel, actions pinned to the bottom edge, flagged fields grouped first, raw → normalized with the reason in words | ✅ |
| The decorative move | Coloured 4px left border on the "Needs review" card | Deleted. Replaced by the margin mark, which encodes state and is read, not decoration. | ✅ |
| Density | Identical padding everywhere | Three deliberate densities: 44px register rows, 32px drawer field rows, 56px stats row | ✅ |

Against the `anti-slop` catalogue: no indigo/purple, no gradients, no glassmorphism, no bento grid, no
aurora blur, no thin interchangeable line icons (the only glyphs are the four status marks, which are
typographic), no uniform fade-in, no coloured left border strip on cards (there are no cards), no
centred hero, no three feature cards. Copy is checked in §9.

---

## 9. What I could not verify, and what needs your call

**Needs a decision from you before M4:**

1. **Lane-first status column** (§6). Spec §6.1 says "status badge, review badge" — two columns. I am
   proposing one `lane` column with the raw pair in `micro` beneath, because two pills per row across
   thirty rows is unreadable and `lane()` already exists in `src/domain/derive.ts` as the operator's
   actual question. This changes the M4 checklist item "badges with text for every value" to cover
   four lanes plus the raw pair, not eight badges. **Approve, or keep the spec's two columns.**
2. **IBM Plex install at M4** — `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`. Per the
   global rule, no install happens without your yes.
3. **14px body in the register.** Denser than the typographic guidance for prose. I think it is right
   for a data grid an operator lives in; say if you would rather have 15px and five fewer rows.

**Unverified:**

- **IBM Carbon's data table usage guidance** and **Atlassian's Lozenge** page both returned truncated
  or navigation-only content to a plain fetch. Neither is cited above, and neither decision here rests
  on them. The `sources.md` registry should be re-vetted on those two entries.
- **Shopify Polaris** now 301-redirects `polaris-react.shopify.com` → `shopify.dev/docs/api/polaris`;
  I did not follow it, so Polaris is not cited. Another registry entry to re-vet.
- **The faces are not rendered in the prototype.** A davinci prototype is one self-contained file with
  no CDN, and the GDPR rule forbids the Google CDN regardless — so the prototype declares the Plex
  stack with a system fallback and will render in the fallback on your machine unless Plex is
  installed locally. The type *scale*, *tabular figures* and *mono identifiers* are all real in the
  prototype; only the letterforms may not be. This resolves itself at M4 with the self-hosted install.
- **APCA was not run** as the perceptual second opinion. WCAG 2.2 is the gate and every pair clears
  it; APCA would only refine, and it is not a compliance standard.
- **No colour-blindness simulation was run** on the rendered screens — the argument in §4 is
  structural (the glyph and word carry the meaning, the colour is redundant) rather than measured.
  Worth an actual simulator pass on the M4 screenshots.
- **Assumption about the audience**: I have taken the operators to be a small in-house team on
  desktop, working long sessions. The brief does not say this. If they are instead many occasional
  field users on tablets, the density argument in §5 inverts.

---

**Approve, revise, or reject.** Nothing gets built until you say. On approval the next step is
`docs/design/prototype.html`: the direction strip plus a fully built dashboard and drawer with real
Alo Relief Trust content — real filenames, real Bangladeshi phone formats, real failure reasons.
