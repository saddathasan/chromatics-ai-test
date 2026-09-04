# Chromatics AI Technical Assignment — Senior Architecture Assessment

## 1. Executive Assessment

**Overall difficulty: 8/10**

**Primary signal:** Product and architecture judgment  
**Secondary signal:** Frontend engineering maturity  
**Tertiary signal:** UI/UX execution

This is **not really an upload UI assignment**.

The actual problem is:

> **Design a frontend system for a large-scale, asynchronous document-processing workflow where data is incomplete, processing is unreliable, and the user needs operational visibility.**

The strongest candidates will recognize that immediately.

The requirement intentionally gives very little direction around:

- information architecture
- domain model
- API contract
- processing lifecycle
- pagination
- filtering
- retry semantics
- confidence handling
- bulk operations
- failure recovery
- real-time updates
- scale strategy

That ambiguity is **the assignment**.

---

# 2. What Chromatics AI Is Actually Evaluating

If I were interviewing the candidate, I would interpret the assignment roughly like this:

| Area | Importance |
|---|---:|
| Product thinking | ⭐⭐⭐⭐⭐ |
| Architecture | ⭐⭐⭐⭐⭐ |
| Large dataset handling | ⭐⭐⭐⭐⭐ |
| Async workflow design | ⭐⭐⭐⭐⭐ |
| Error/retry handling | ⭐⭐⭐⭐⭐ |
| State management | ⭐⭐⭐⭐ |
| TypeScript/code quality | ⭐⭐⭐⭐ |
| UI/UX | ⭐⭐⭐⭐ |
| Accessibility | ⭐⭐⭐ |
| Visual polish | ⭐⭐⭐ |
| AI/OCR implementation | ⭐ |
| Number of features | ⭐ |

The document explicitly says:

> "good judgment and clear thinking more than feature count"

This should be taken **very seriously**.

A candidate who builds 15 screens but has a poor data architecture should score lower than someone who builds 4 excellent screens around a well-designed domain model.

---

# 3. The Core Architectural Challenge

The most important thing the candidate needs to understand is that there are **multiple states**, not one.

For example:

```text
File
 ↓
Uploaded
 ↓
Queued
 ↓
Processing
 ↓
Completed
 ↓
Normalized
 ↓
Needs Review
```

But failures can occur at several points:

```text
Upload Failed
Processing Failed
OCR Failed
Extraction Failed
Validation Failed
Low Confidence
```

And these are fundamentally different things.

A sophisticated implementation should not simply have:

```ts
status: "pending" | "processing" | "completed" | "failed"
```

It should probably distinguish between:

### Document lifecycle

```ts
type DocumentStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";
```

### Review/data quality

```ts
type ReviewStatus =
  | "not_required"
  | "needs_review"
  | "reviewed";
```

And potentially:

```ts
type ProcessingResult = {
  confidence: number;
  missingFields: string[];
  warnings: string[];
};
```

This distinction is a **major architectural signal**.

---

# 4. The 100,000 Files Requirement Is the Biggest Trap

This sentence is probably one of the most important in the entire assignment:

> "a real batch could be very large — up to roughly 100,000 files"

They explicitly say you do not have to actually upload 100,000 files.

That means they are testing whether you understand that:

### Bad approach

```tsx
documents.map(...)
```

with 100,000 objects rendered into the DOM.

Or:

```ts
const [documents, setDocuments] = useState<Document[]>([]);
```

where every document and every processing update lives in client state.

That will demonstrate that the candidate **didn't understand the requirement**.

### Better approach

The frontend should behave as though the backend owns the dataset.

```text
Backend
   │
   ├── paginated documents
   ├── batch statistics
   ├── processing events
   └── individual document details
          ↓
Frontend
   │
   ├── virtualized list/table
   ├── pagination/cursor
   ├── filters
   └── cached server state
```

For a React application, I would expect something along the lines of:

- TanStack Query for server state
- cursor/page-based fetching
- virtualization if rendering large result sets
- local state only for UI concerns
- mutation-driven updates
- polling/WebSocket/SSE simulation if appropriate

Given a modern React/TypeScript stack, **TanStack Query + TypeScript + React + virtualization** would be an excellent fit here.

---

# 5. The UI Should Probably Be an Operations Dashboard

I would **not** build this primarily as:

> Upload → wait → see result

Instead, think:

> **Document Processing Operations Center**

The primary screen should probably give the user an immediate answer to:

### "What is happening with my archive right now?"

Something like:

```text
┌──────────────────────────────────────────────────────────┐
│ Document Processing                                      │
│                                                          │
│ 98,421 Documents     82,310 Completed    4,821 Failed    │
│ 3,210 Processing     8,080 Pending                       │
│                                                          │
│ [ Upload ] [ Retry Failed ]                              │
│                                                          │
│ Search documents...       Status ▼  Type ▼  Program ▼    │
├──────────────────────────────────────────────────────────┤
│ Document       Type       Status       Confidence         │
│ ──────────────────────────────────────────────────────── │
│ enrollment.pdf Enrollment Completed    98%                │
│ medical-12.pdf Medical    Review       61%                │
│ id-card.jpg    ID         Processing   --                 │
│ notes-23.pdf   Notes      Failed       --                 │
└──────────────────────────────────────────────────────────┘
```

This is much more aligned with the actual problem.

---

# 6. Upload Is Important, But Probably Not the Main Feature

The requirement says:

> upload documents, one at a time or in bulk

A weaker candidate might spend 50% of their time building a beautiful drag-and-drop uploader.

I would not.

Upload should be polished but relatively simple.

The interesting part is what happens **after upload**.

For example:

```text
Drop 500 files
      ↓
Upload Queue
      ↓
Uploading 420/500
      ↓
420 uploaded
      ↓
Processing
      ↓
380 completed
25 processing
15 failed
      ↓
Review problematic documents
```

The user needs to understand this workflow.

---

# 7. Batch Processing Is Missing From the Data Model

One thing I would expect a strong candidate to introduce is the concept of a **Batch**.

The requirements talk about:

> "a real batch could be very large"

But don't define what a batch actually is.

The candidate should make that assumption explicit.

For example:

```ts
type Batch = {
  id: string;
  name: string;
  createdAt: string;

  total: number;
  uploaded: number;
  processing: number;
  completed: number;
  failed: number;
  needsReview: number;
};
```

And:

```ts
type Document = {
  id: string;
  batchId: string;

  fileName: string;
  fileType: string;
  size: number;

  status: DocumentStatus;

  extractedData?: NormalizedRecord;

  confidence?: number;

  error?: ProcessingError;

  createdAt: string;
  updatedAt: string;
};
```

This makes the application much easier to reason about.

---

# 8. The Normalized Record Is Deliberately Underspecified

The example:

```text
documentId
personName
phone
location
programName
date
documentType
confidence
processingStatus
```

is explicitly called:

> "Example Only"

That's important.

A good candidate should not blindly build a table around those exact fields.

Instead, they should ask:

### What does the user actually need?

Potentially:

```ts
type NormalizedRecord = {
  person?: {
    name?: string;
    phone?: string;
  };

  location?: {
    region?: string;
    address?: string;
  };

  program?: {
    name?: string;
  };

  document?: {
    type?: string;
    date?: string;
  };

  extraction?: {
    confidence: number;
    missingFields: string[];
    warnings: string[];
  };
};
```

This allows the UI to communicate uncertainty.

---

# 9. Confidence Is Not Just a Number

This is another major product-design challenge.

Bad:

```text
Confidence: 72%
```

That's technically correct but not particularly useful.

A better interface could communicate:

```text
⚠ Needs Review

Name
John Doe                98%

Phone
+880...                 91%

Program
Unknown                 --

Date
12/04/2026              64%
```

The user can immediately identify what is uncertain.

Even better, the system could define:

```text
90–100%  High confidence
70–89%   Review recommended
<70%     Review required
```

The exact thresholds would be an assumption and should be documented.

That is precisely the type of assumption the assignment invites.

---

# 10. Incomplete Data Needs Its Own UX

This requirement is particularly important:

> "Expect these values to sometimes be missing, inconsistent, or uncertain — the interface should make that reality visible rather than hide that reality."

That means:

### Bad

```text
Phone: -
Location: -
Program: -
```

The user doesn't know whether:

- extraction failed
- the document didn't contain the information
- OCR couldn't read it
- the value is uncertain

### Better

```text
Phone
Not detected

Location
Missing from document

Program
Needs verification

Date
12/08/2026
Confidence: 62%
```

The UI should distinguish:

```text
Missing
Unknown
Uncertain
Failed
Not applicable
```

That's a strong product decision.

---

# 11. Individual Document Detail Is Where the Product Becomes Interesting

I would expect a detail drawer/page.

Something like:

```text
Document Details

┌───────────────────────────────────┐
│ enrollment-form-1823.pdf          │
│ Completed • Needs Review          │
├───────────────────────────────────┤
│                                   │
│ Extracted Information             │
│                                   │
│ Name                              │
│ John Doe               98%        │
│                                   │
│ Phone                             │
│ +880...                 82%       │
│                                   │
│ Program                           │
│ Education Program       63%       │
│                                   │
│ Location                          │
│ Dhaka                             │
│                                   │
│ ⚠ 2 fields need review            │
│                                   │
├───────────────────────────────────┤
│ Processing Information            │
│                                   │
│ Uploaded  10:42 AM                │
│ Started   10:43 AM                │
│ Finished  10:44 AM                │
└───────────────────────────────────┘
```

If there is no actual document preview, that's fine.

A mocked preview can be used.

---

# 12. Failure Handling Is a First-Class Feature

This is another area where the assignment is testing engineering maturity.

Don't just show:

```text
Failed ❌
```

The user needs:

```text
Processing failed

Reason:
Unable to extract readable text from document.

[Retry]
```

Potential error categories:

```ts
type ProcessingError =
  | {
      code: "UNREADABLE_DOCUMENT";
      message: string;
    }
  | {
      code: "PROCESSING_TIMEOUT";
      message: string;
    }
  | {
      code: "UNSUPPORTED_FORMAT";
      message: string;
    }
  | {
      code: "EXTRACTION_FAILED";
      message: string;
    };
```

And importantly:

### Retry should be scoped.

The user might want:

```text
Retry this file
```

or:

```text
Retry all failed files
```

or:

```text
Retry selected files
```

That's where batch operations become useful.

---

# 13. Idempotency Should Be Considered

This is more backend-oriented, but a senior frontend architect should at least recognize the issue.

Suppose the user uploads:

```text
document.pdf
```

and then clicks Retry.

What prevents:

```text
document.pdf
document.pdf
```

from becoming two independent records?

The frontend doesn't necessarily need to solve this, but the architecture documentation should acknowledge that:

> Upload and processing operations should be idempotent and identified by stable document/batch IDs.

That's the kind of statement I'd expect from a senior candidate.

---

# 14. State Management

This assignment is a very good test of whether someone understands the difference between:

### Server state

```text
documents
batches
processing statuses
processing results
errors
statistics
```

and:

### UI state

```text
selected document
open drawer
active filters
search query
sort order
upload modal
selected rows
```

A strong architecture could be:

```text
                 React
                   │
       ┌───────────┴───────────┐
       │                       │
 UI State                  Server State
       │                       │
 useState/Zustand          TanStack Query
                               │
                         Mock API layer
                               │
                           Fixtures
```

You don't need Redux here.

In fact, using Redux purely to demonstrate state management would probably be unnecessary.

---

# 15. I Would Strongly Recommend a Mock API Layer

Instead of putting everything inside components:

```ts
setTimeout(() => {
  setDocuments(...)
}, 1000);
```

I'd build a small API abstraction:

```ts
documentApi.list()
documentApi.get()
documentApi.upload()
documentApi.retry()

batchApi.get()
```

Then simulate:

```text
GET /batches
GET /batches/:id
GET /documents
GET /documents/:id
POST /documents
POST /documents/:id/retry
POST /batches/:id/retry-failed
```

Even if everything is local.

This demonstrates that the frontend architecture isn't coupled to mocked implementation details.

---

# 16. Simulating 100,000 Records

This is where I would expect an especially strong submission.

You don't need 100,000 actual files.

Instead:

```ts
const TOTAL_DOCUMENTS = 100_000;
```

Generate deterministic fixtures.

For example:

```text
100,000 records
│
├── 65% completed
├── 10% processing
├── 15% pending
├── 5% failed
└── 5% needs review
```

Then expose only a page:

```text
GET /documents?page=4&pageSize=50
```

This gives the reviewer confidence that the candidate understands scale.

---

# 17. Virtualization vs Pagination

I'd actually use both concepts appropriately.

### Pagination / cursor pagination

Controls how much data is fetched.

### Virtualization

Controls how many DOM nodes are rendered.

They solve different problems.

For a table showing 50 or 100 records per page, virtualization may not even be necessary.

But if the candidate wants to demonstrate handling a large client-side list, virtualization is useful.

The important thing is **not blindly adding virtualization because "100k rows = virtualization."**

A senior candidate should explain the tradeoff.

---

# 18. Search and Filtering

For 100k records, search should conceptually be server-side.

Bad architecture:

```ts
documents.filter(...)
```

against the entire 100k dataset in the browser.

Better:

```text
GET /documents?
    search=john
    &status=failed
    &documentType=medical
    &page=...
```

Even with a mock backend, simulate this boundary.

Useful filters:

- status
- document type
- confidence
- batch
- program
- date
- review status

Don't build 20 filters just because you can.

I'd prioritize:

```text
Search
Status
Document type
Review status
```

---

# 19. Real-Time Processing Updates

A processing system naturally wants:

```text
Pending → Processing → Completed
```

There are three obvious approaches:

### Polling

Simple and perfectly acceptable for the assignment.

```text
GET /batches/:id
every 2–5 seconds
```

### SSE

Good for server-to-client status events.

### WebSocket

More complex and probably unnecessary.

For this assignment, I'd probably use **polling in the prototype**, and explicitly state:

> "For production, I would evaluate SSE/WebSockets depending on event volume and infrastructure requirements."

That demonstrates judgment.

---

# 20. Accessibility Should Not Be an Afterthought

The requirement explicitly mentions accessibility.

I'd expect:

- keyboard-accessible upload
- proper labels
- semantic buttons
- focus management in dialogs/drawers
- keyboard navigation
- accessible status indicators
- no status information communicated only through color
- `aria-live` where appropriate for upload/processing updates
- sufficient contrast
- screen-reader-friendly error messages

For example:

Don't do:

```text
● Failed
```

where red is the only signal.

Instead:

```text
[Failed] Processing failed
```

---

# 21. Recommended Frontend Architecture

If I were implementing this assignment, I'd structure it approximately like this:

```text
src/
│
├── app/
│   ├── router/
│   ├── providers/
│   └── layout/
│
├── features/
│   │
│   ├── batches/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── documents/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── upload/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   │
│   └── processing/
│       ├── components/
│       └── types/
│
├── components/
│   ├── ui/
│   └── data-table/
│
├── lib/
│   ├── api/
│   ├── query/
│   └── utils/
│
├── mocks/
│   ├── fixtures/
│   ├── handlers/
│   └── generators/
│
└── types/
```

The exact structure doesn't matter.

The separation of **domain concerns** does.

---

# 22. Suggested Application Architecture

```text
                    ┌──────────────────┐
                    │   React UI       │
                    └────────┬─────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
           UI State                Server State
                 │                       │
          useState/Zustand          TanStack Query
                                         │
                                         ▼
                                  API abstraction
                                         │
                              ┌──────────┴─────────┐
                              │                    │
                         Mock Backend         Future API
                              │
                       Fixture Generator
                              │
                       100k simulated docs
```

This gives you a clean migration path from prototype to production.

---

# 23. Recommended Screens

I wouldn't build a huge application.

I'd build **three primary experiences**.

### 1. Processing Dashboard

The main operational view.

Contains:

- batch statistics
- upload button
- document table
- search
- filters
- status
- confidence
- bulk selection/actions

### 2. Upload Flow

Could be a modal/page.

Contains:

- drag/drop
- file selection
- individual/bulk uploads
- upload progress
- validation errors
- batch creation
- processing transition

### 3. Document Detail

Contains:

- file metadata
- extracted fields
- confidence
- missing/uncertain data
- processing timeline
- errors
- retry
- review state

That's enough.

---

# 24. The Most Important UX Flow

I'd make this flow extremely polished:

```text
Upload 100 files
       ↓
Create Batch
       ↓
Uploading
       ↓
Upload complete
       ↓
Processing begins
       ↓
Dashboard updates
       ↓
Some succeed
Some fail
Some need review
       ↓
Filter "Needs Review"
       ↓
Open document
       ↓
Inspect extracted data
       ↓
Retry / mark reviewed
```

If this flow feels excellent, the assignment succeeds.

---

# 25. What I Would NOT Build

This is important because the assignment explicitly rewards scope discipline.

I would **not** spend time building:

- authentication
- user management
- permissions
- actual OCR
- actual AI
- backend database
- cloud storage
- complex analytics
- elaborate settings
- notification systems
- multi-language support
- complicated document editing
- full production upload infrastructure

Unless something is exceptionally easy.

The candidate should demonstrate:

> **"I know what not to build."**

That's a senior engineering trait.

---

# 26. What I Would Put in the README

The README is actually part of the assessment.

I would structure it like this:

```md
# Chromatics AI Document Processing Prototype

## Overview

## Product Assumptions

### Batch Model
### Document Lifecycle
### Confidence Model
### Failure Model

## Architecture

## State Management

## Large Dataset Strategy

## Async Processing Simulation

## API Contract

## UX Decisions

## Accessibility

## Performance Considerations

## Trade-offs

## Known Limitations

## What I Would Do Next

## Running Locally
```

The **assumptions** section is particularly important.

---

# 27. Example Assumptions I'd Expect

```md
### Assumptions

1. A batch represents a single upload operation and may contain
   thousands of documents.

2. The backend owns the document dataset. The frontend never loads
   the complete 100,000-document dataset into memory.

3. Document processing is asynchronous and status updates are
   eventually consistent.

4. Confidence below a configurable threshold causes a document
   to enter a review state.

5. Missing fields are distinct from failed processing.

6. Retry operates on failed documents without creating duplicates.

7. Search and filtering are server-side operations.

8. The prototype uses mocked APIs and deterministic fixtures to
   simulate production-scale behavior.
```

That README alone tells me the candidate understands the system.

---

# 28. Potential Red Flags in a Candidate Submission

If I were reviewing submissions, these would worry me.

### 🚩 Everything in one component

```text
App.tsx
1500 lines
```

### 🚩 All 100k documents loaded into React state

### 🚩 No pagination

### 🚩 No clear data model

### 🚩 Status represented only as colors

### 🚩 No retry functionality

### 🚩 Failure just says "Something went wrong"

### 🚩 Confidence shown but never explained

### 🚩 Missing data rendered as `-`

### 🚩 Upload dominates the application

### 🚩 No loading/error/empty states

### 🚩 Mock API tightly coupled to UI

### 🚩 No README assumptions

### 🚩 Huge dependency list with no justification

### 🚩 Redux everywhere without a reason

### 🚩 Actual OpenAI/OCR API added just to "look impressive"

The last one is especially important.

The assignment explicitly says:

> "Using AI is entirely optional — it is not required, and it is not worth extra credit on its own."

So using AI doesn't demonstrate much.

Designing the system **as though AI exists behind the API boundary** is much more valuable.

---

# 29. What Would Impress Me

These would make me think:

> "This person understands production frontend architecture."

### Excellent

```text
100k simulated documents
        ↓
server-side pagination
        ↓
TanStack Query
        ↓
clean API abstraction
        ↓
realistic async state transitions
        ↓
batch-level progress
        ↓
document-level status
        ↓
confidence-aware normalized data
        ↓
retry/recovery
        ↓
good loading/error/empty states
```

And then:

> "The mock implementation can be replaced with a real API without changing the UI."

That's a very strong signal.

---

# 30. Recommended Technical Stack

For this specific assignment:

| Technology | Recommendation |
|---|---|
| React | ✅ |
| TypeScript | ✅ Strongly |
| Vite | ✅ |
| TanStack Query | ✅ Strongly |
| TanStack Table | ✅ |
| Tailwind | ✅ |
| shadcn/ui | ✅ |
| Zod | ✅ |
| MSW | ✅ Excellent choice |
| Faker/custom fixtures | ✅ |
| React Virtuoso/TanStack Virtual | Optional |
| Recharts | Optional |
| Zustand | Optional |
| Redux | ❌ Unnecessary |
| Real AI API | ❌ Unnecessary |
| Backend | Optional |

A strong implementation could use:

```text
React
TypeScript
Vite
Tailwind
shadcn/ui
TanStack Query
TanStack Table
Zod
MSW
```

---

# 31. How I Would Score the Assignment

If I were creating an internal evaluation rubric:

| Category | Weight |
|---|---:|
| Product/UX reasoning | 15 |
| Architecture | 20 |
| Large dataset strategy | 15 |
| Async workflow/state modeling | 15 |
| Error/retry/partial failure handling | 10 |
| Code quality & TypeScript | 10 |
| Performance | 5 |
| Accessibility | 5 |
| README/documentation | 5 |
| **Total** | **100** |

Then:

### 90–100 — Exceptional

Production-minded architecture, excellent UX, understands scale and failure modes.

### 80–89 — Strong

Very good implementation with sensible trade-offs and only minor architectural gaps.

### 70–79 — Good

Functional and reasonably structured, but some production concerns aren't fully addressed.

### 60–69 — Average

Mostly UI-focused, limited architectural thinking.

### <60 — Weak

Feature-heavy but doesn't address the actual complexity of the problem.

---

# 32. Assessment of the Requirement Itself

As an assignment, I would give it:

**9/10**

It is strong because it deliberately avoids prescribing:

```text
"Build X using Y library."
```

Instead it asks:

> Here's a messy real-world problem. Show us how you think.

That's much closer to a senior frontend engineering problem.

The only weakness is that **the scope can become enormous** if the candidate interprets every requirement literally. A candidate could easily spend 30–50 hours trying to build a miniature document-management platform.

The wording does partially protect against that by saying:

> "a well-scoped, thoughtfully engineered slice is worth more to us than a large, unfinished one."

I would therefore interpret the assignment as asking for **depth rather than breadth**.

---

# 33. The Ideal Submission in One Sentence

> **Build a polished document-processing operations dashboard that simulates a 100,000-document backend, uses paginated server-state fetching, models asynchronous processing explicitly, exposes incomplete/uncertain extraction clearly, and provides sensible recovery for failures.**

That is the core.

---

# 34. If I Were the Candidate, This Is Exactly What I'd Build

My MVP would be:

```text
                    DOCUMENT PROCESSING
─────────────────────────────────────────────────────

  100,000 Documents     82,340 Completed
  3,120 Processing       9,820 Pending
  4,720 Failed

  [ Upload Documents ]

  Search documents...       Status ▼    Review ▼

─────────────────────────────────────────────────────
☐ File              Type          Status       Confidence
─────────────────────────────────────────────────────
☐ enrollment-01.pdf Enrollment    Completed     98%
☐ medical-02.pdf    Medical       Needs Review  61%
☐ id-card-03.jpg    ID            Processing      -
☐ notes-04.pdf      Notes         Failed          -
─────────────────────────────────────────────────────

                   [Retry Selected]
```

Then:

**Upload modal → batch creation → simulated processing → dashboard updates → filtering → document detail → retry/review.**

That's enough to demonstrate almost everything they're asking for.

And I'd spend the remaining effort on:

**architecture + state transitions + realistic data + edge cases + README**, not additional screens.

---

# 35. Final Verdict

This assignment is **not primarily testing whether someone can build a React dashboard**.

It's testing whether they can answer:

> **"If this frontend eventually sits in front of a system processing 100,000 messy real-world documents asynchronously, how would you design it so that a human operator can actually trust and operate it?"**

A junior/mid-level candidate will likely focus on **components and screens**.

A strong senior frontend candidate will focus on:

**domain model → state machine → server state → scale → async workflows → failure modes → data quality → UX → performance → accessibility → trade-offs.**

That distinction is what I would use as the central lens for evaluating the submission.
