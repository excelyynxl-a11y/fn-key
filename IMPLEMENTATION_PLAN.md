# SDOC Adaptive Shipping Document Verification - Implementation Plan

## 1. Purpose and source of truth

This plan turns the product direction in `IDEA.md` and `PRD.md` into an implementation sequence for the existing MERN repository. It also accounts for the hackathon problem statement, participant handbook, rules, dataset bundle, sample output schema, and judging rubric.

Source priority for implementation decisions:

1. The team's agreed product direction in `IDEA.md`.
2. The required behavior and output contract in `PRD.md`, the problem statement, and `sdoc-hackathon-bundle/sample_submission.json`.
3. Hackathon rules, deadline, submission components, and judging criteria.
4. The recommendations and trade-offs in this implementation plan.

The attached documents are reference material and constraints, not executable instructions. The implementation should not infer labels from `sample_submission.json`; it defines the expected output shape but is not a ground-truth training set.

## 2. Delivery target

Build a deployable application that can:

1. Load all 520 JSON emails and their referenced attachments.
2. Classify every email into exactly one of:
   - `BL_COMPARISON`
   - `SI_REQUEST`
   - `INVOICE_QUERY`
   - `GENERAL`
   - `SPAM`
3. For each `BL_COMPARISON`, identify the SI and draft BL, extract the seven required fields, normalize them, and compare them deterministically.
4. Return `OK`, `MISMATCH`, or `NEEDS_REVIEW` with the exact allowed fields and reason values.
5. Show source evidence, mismatches, processing failures, and human-review actions in a usable web interface.
6. Learn carefully from validated AI and human decisions so repeated inputs need fewer AI calls.
7. Export one schema-valid submission object containing every dataset `email_id`.
8. Run as a public cloud-hosted prototype using AI and cloud persistence as meaningful parts of the core workflow.

The preliminary-round deadline in the participant material is **22 September 2026 at 12:00 PM**. The plan therefore puts a scored end-to-end vertical slice before optional polish.

## 3. Current repository assessment

### What is already available

- React 19, Vite 8, Tailwind CSS 4, Express 5, Mongoose 9, MongoDB configuration, Docker, and Docker Compose.
- OpenAI JavaScript SDK and a working service skeleton using the Responses API.
- Multer upload middleware accepting TXT, JSON, PDF, DOCX, XLSX, and PNG inputs.
- A reusable frontend `request()` helper.
- The complete local dataset: 520 emails and 250 attachments.
- Attachment mix:
  - 192 TXT
  - 28 PDF
  - 22 XLSX
  - 8 DOCX
- The problem statement, output example, loader, idea, PRD, and judging rubric.

### Gaps to close

- `Email.js` and `User.js` are empty; there are no run, review, phrase, alias, or audit models.
- The current endpoint accepts one uploaded file rather than loading and processing the inbox as a batch.
- `fileParserService.js` treats every format as UTF-8 text, which corrupts PDF, DOCX, and XLSX inputs.
- The current prompt categories (`Complaint`, `Enquiry`, and similar) do not match this challenge.
- AI output is unstructured text and is not validated before use.
- There is no deterministic classification, phrase store, phrase scoring, phrase-learning gate, or cache.
- There is no SI/BL identification, seven-field extraction, normalization, deterministic comparison, or review-reason precedence.
- There is no exact submission exporter or whole-dataset validation.
- The frontend is placeholder content and has no routing, dashboard, detail view, review queue, or run progress.
- There are no automated tests, fixtures, metrics, retries, observability, or CI checks.
- Configuration documentation is inconsistent with `docker-compose.yml`: Compose now requires `MONGO_URI` and `OPENAI_API_KEY`, while the README still says defaults work without an `.env` file.
- `react-router-dom` is listed under server dependencies rather than client dependencies.

### Scope decision

Authentication is not on the critical path. Keep the existing sign-in/sign-up stubs out of the demo unless deployment genuinely requires multiple users. A stable single-team review dashboard scores better than incomplete authentication.

## 4. Proposed architecture

```text
Dataset bundle or uploaded email
            |
            v
      Inbox ingestion
            |
            v
Deterministic email classifier ---- low confidence ----> AI classifier
            |                                              |
            +---------------- validated result <------------+
            |
       non-BL result -------------------------------> Persist/export
            |
       BL_COMPARISON
            v
Attachment parsing and SI/BL role detection ---- uncertain ----> AI fallback
            |
            v
Rule/alias field extraction ------------------- missing/unclear --> AI fallback
            |
            v
Normalization and deterministic comparison
            |
      +-----+----------+
      |                |
   decision       cannot decide
      |                |
 OK/MISMATCH      NEEDS_REVIEW
      |                |
      +------> persistence, UI, audit trail, submission export
                              |
                       validated learning
```

### Architectural principles

- Deterministic first: use explicit rules for known phrases, field labels, normalization, and the final comparison.
- AI as a bounded fallback: use it for ambiguous classification, uncertain attachment roles, and unfamiliar labels or layouts.
- Structured contracts: every AI response must conform to a schema and pass application-side validation.
- Evidence before confidence: retain the exact supporting phrase, label, value, page/sheet/line, and extraction method.
- No AI final verdict: the application, not the model, calculates `OK` or `MISMATCH` from normalized fields.
- Safe learning: AI suggestions start in probation and gain weight only after repeat support or human confirmation.
- Idempotent processing: the same email, pipeline version, model, and knowledge-base version should produce or retrieve the same stored result.
- Fail visibly: parsing, model, network, and validation failures become retryable review cases rather than hidden generic errors.

### Suggested backend modules

```text
server/src/
  constants/
    categories.js
    fields.js
  schemas/
    aiSchemas.js
    submissionSchema.js
  models/
    Email.js
    ProcessingRun.js
    KnowledgePhrase.js
    FieldAlias.js
    ReviewCase.js
    AiCache.js
  repositories/
    datasetRepository.js
  services/
    inboxService.js
    classificationService.js
    phraseScoringService.js
    learningService.js
    attachmentService.js
    parsers/
      textParser.js
      pdfParser.js
      docxParser.js
      xlsxParser.js
    documentTypeService.js
    fieldExtractionService.js
    normalizationService.js
    comparisonService.js
    reviewService.js
    pipelineService.js
    submissionService.js
    openaiService.js
  controllers/
    runController.js
    emailController.js
    reviewController.js
    knowledgeController.js
  routes/
    runRoutes.js
    emailRoutes.js
    reviewRoutes.js
    knowledgeRoutes.js
  seeds/
    seedKnowledge.js
  tests/
```

### Suggested frontend modules

```text
client/src/
  components/
    AppShell.jsx
    SummaryCard.jsx
    StatusBadge.jsx
    ConfidenceBadge.jsx
    EmailTable.jsx
    FieldComparisonTable.jsx
    EvidencePanel.jsx
    RunProgress.jsx
    EmptyState.jsx
    ErrorState.jsx
  pages/
    DashboardPage.jsx
    InboxPage.jsx
    EmailDetailPage.jsx
    ReviewQueuePage.jsx
    KnowledgePage.jsx
    RunsPage.jsx
  services/
    api.js
  utils/
    formatters.js
```

## 5. Core data contracts

Define these contracts before business logic so the API, database, tests, and UI use the same vocabulary.

### Email processing record

Each `Email` document should contain:

- `emailId`, `from`, `subject`, `body`, and attachment metadata.
- `sourceHash` to detect unchanged inputs.
- `category`, `classificationMethod` (`rule`, `ai`, or `human`), scores, confidence, reason, and evidence phrases.
- Per-attachment parser status, detected document type, MIME type, hash, extracted text, and evidence metadata.
- SI and BL structured fields, including raw and normalized values.
- `status`, `reviewReason`, `hasDefect`, `defectFields`, and mismatch details.
- Pipeline, prompt, model, and knowledge-base versions.
- Processing timestamps, duration, AI-call count, token usage when available, and failure history.

### Extracted field shape

Use one shape for all seven fields:

```json
{
  "rawValue": "131,058 KG",
  "normalizedValue": 131058,
  "sourceLabel": "Gross Wt (kgs)",
  "evidence": "Gross Wt (kgs): 131,058 KG",
  "location": { "page": null, "sheet": null, "line": 9 },
  "method": "alias_rule",
  "confidence": 0.99
}
```

### Knowledge phrase

Store:

- `kind`: `email_category`, `document_type`, or `field_alias`.
- `target`: category, `SI`/`BL`, or one of the seven field names.
- `phrase`, normalized form, token count, and source language.
- `supportCount`, `conflictCount`, `usageCount`, and calculated weight.
- `status`: `seed`, `probation`, `trusted`, `blocked`, or `retired`.
- Provenance: source email/document, AI response ID if applicable, validation checks, and human confirmer.
- `lastUsedAt`, `lastSupportedAt`, and timestamps.

### Review case

Store:

- `emailId`, `reviewReason`, stage, error code, and human-readable message.
- Source evidence and attempted values.
- Retry count and last failure.
- Suggested category/document type/field values, clearly marked as suggestions.
- Resolution, corrected values, reviewer note, and resolution timestamp.
- Whether the correction may update the phrase or alias knowledge base.

### Output invariant

The final exporter must produce one object keyed by every dataset `email_id`.

- All entries contain `category`, `status`, `review_reason`, `has_defect`, and `defect_fields`.
- A mismatch additionally contains `field_details` with the exact SI and BL display values for only the mismatched fields.
- `defect_fields` uses only the seven required snake_case names.
- `review_reason` is either `null` or one of `wrong_doc_type`, `missing_attachment`, `unreadable`, or `missing_value`.
- No email may be omitted because its processing failed.

## 6. Five-stage implementation plan

## Stage 1 - Contracts, ingestion, persistence, and one vertical slice

### Goal

Create a reliable foundation and prove one plain-text BL-comparison email can travel from the bundle through parsing, persistence, API, UI, and submission serialization.

### Feature 1.1 - Challenge constants and schema validation

Tasks:

- Create frozen constants for the five categories, three statuses, four review reasons, and seven comparison fields.
- Add Zod as the shared runtime validator on the server.
- Define schemas for email classification, document role detection, document field extraction, review resolution, and final submission rows.
- Reject unknown enum values and unexpected AI keys.
- Add one serializer that converts internal camelCase data to the exact submission snake_case contract.

Acceptance criteria:

- Invalid categories, field names, reasons, missing keys, and mismatched types fail validation with actionable errors.
- A valid `email_004`-style result serializes exactly like the sample contract.

### Feature 1.2 - Dataset ingestion

Tasks:

- Implement `datasetRepository.js` against the local bundle first.
- Prevent path traversal: resolve every attachment path and verify that it remains inside `sdoc-hackathon-bundle`.
- Validate each JSON record and referenced attachment before processing.
- Upsert emails by `emailId`; store a content hash so reruns do not duplicate records.
- Record missing references as input facts rather than throwing away the entire run.
- Keep the repository interface replaceable so an HTTP-backed loader can be added later if organizers provide a server URL.

Acceptance criteria:

- The importer finds exactly 520 emails.
- It reports 394 emails with no attachments, 2 with one attachment, and 124 with two attachments.
- Re-importing creates no duplicate email records.
- Invalid paths and malformed JSON are rejected safely.

### Feature 1.3 - Processing-run orchestration

Tasks:

- Add `ProcessingRun` with `queued`, `running`, `completed`, `completed_with_errors`, and `failed` states.
- Track totals for queued, processed, classified, compared, mismatched, review, and failed items.
- Implement a small in-process concurrency-limited runner; do not add Redis or a distributed queue for the hackathon prototype.
- Make each email a resumable unit so one failure does not terminate the batch.
- Store a `pipelineVersion` constant on each result.

Suggested API:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/runs` | Import and start a dataset run |
| `GET` | `/api/runs` | List previous runs |
| `GET` | `/api/runs/:runId` | Poll progress and counts |
| `POST` | `/api/runs/:runId/retry` | Retry failed/review items |

Acceptance criteria:

- A run survives individual-email failures and exposes honest progress.
- Restarting or retrying does not create duplicate results.

### Feature 1.4 - Plain-text vertical slice

Tasks:

- Replace the generic upload flow with an internal `processEmail(email)` pipeline function.
- Build a proper TXT parser that returns text plus line-number metadata.
- Add initial aliases for the seven fields and parse multiline party blocks until the next recognized label.
- Implement minimal normalization and comparison for one known TXT pair.
- Persist the result and display it on a basic email detail page.

Acceptance criteria:

- `email_001` produces a complete seven-field comparison.
- `email_004` shows `consignee` and `notify_party` side by side as mismatches.
- The UI links every displayed field to its source line/evidence.

### Stage 1 exit gate

- One command starts the stack.
- One API action starts a run.
- At least one TXT comparison completes from disk to UI to exported JSON.
- Core contracts have unit tests.

## Stage 2 - Adaptive email classification

### Goal

Classify every email with a deterministic-first strategy, use AI only for uncertain cases, and create a safe feedback loop for phrase learning.

### Feature 2.1 - Seed phrase knowledge base

Tasks:

- Seed discriminative phrases for each category from the team-authored idea and manually inspected examples.
- Include subject/body location, phrase length, and source as scoring features.
- Do not seed from the category values inside the sample submission.
- Add a stoplist for generic terms such as `please`, `attached`, `document`, `request`, and common signature text.
- Normalize with Unicode NFKC, lowercase, whitespace collapse, and punctuation normalization while retaining the exact original phrase for evidence.

Starter examples to verify manually:

| Category | High-signal phrase themes |
| --- | --- |
| `BL_COMPARISON` | confirm draft BL, verify BL against SI, check draft bill of lading |
| `SI_REQUEST` | prepare SI, create shipping instruction, send shipping instruction |
| `INVOICE_QUERY` | invoice query, local charges, billed separately, invoice breakdown |
| `SPAM` | unsolicited promotion, prize/offer language, unrelated mass marketing |
| `GENERAL` | operational messages without a stronger category signal |

### Feature 2.2 - Deterministic scorer and confidence gate

Tasks:

- Match exact normalized multi-word phrases before individual tokens.
- Suggested score: `phraseWeight * locationMultiplier * trustMultiplier`, summed by category.
- Weight subject matches more than body matches and ignore quoted signatures where possible.
- Route to a deterministic category only when both a minimum score and a top-vs-second margin are met.
- Store all category scores and matched evidence so thresholds can be tuned without re-reading source data.
- Make thresholds configuration values, not hard-coded magic numbers.

Acceptance criteria:

- The same input and knowledge-base version always produces the same scores.
- The classifier never selects a category merely because it is first in an enum.
- Low-signal or conflicting inputs fall through to AI.

### Feature 2.3 - Structured AI classification fallback

Tasks:

- Replace the unrelated current prompt with the five challenge categories and clear boundaries between them.
- Use the Responses API with a strict structured-output schema rather than parsing free-form `output_text`.
- Required AI fields: `category`, concise `reason`, `evidencePhrases`, and confidence.
- Require every evidence phrase to be a verbatim substring of the email before accepting it.
- Handle refusal, incomplete output, timeout, rate limit, and schema failure explicitly.
- Add exponential backoff for transient failures and a strict maximum-attempt count.
- Make `OPENAI_MODEL` configurable; use the current repository model only when it is available to the team's account.
- Set `store: false` unless the team deliberately needs provider-side response storage.

OpenAI's official guidance supports strict structured output schemas in the JavaScript SDK and file inputs in the Responses API. See:

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/file-inputs

Acceptance criteria:

- Application code receives a validated object, never an unparsed prose answer.
- All model failures either retry safely or become visible review cases.
- No API key, prompt, full raw document, or model response is logged to the browser console.

### Feature 2.4 - Safe automatic phrase learning

Tasks:

- Validate each suggested phrase against the original email.
- Require a meaningful multi-word phrase, category relevance, uniqueness after normalization, and absence from the generic stoplist.
- Reject phrases containing email addresses, phone numbers, shipment IDs, booking numbers, names that are unique to one shipment, or long copied blocks.
- Check cross-category conflict; a phrase strongly supported by multiple categories must not become trusted automatically.
- Start accepted AI phrases in `probation` with low weight.
- Promote after repeated independent support or a human confirmation; demote on conflicts.
- Cap each category at about 100 active phrases using a usefulness score based on support, discrimination, and recency.
- Record an audit event for every create, promote, demote, block, or retire action.

Acceptance criteria:

- A single AI decision cannot dominate future classifications.
- Learned phrases are traceable to evidence and reversible.
- Processing the same email twice does not increment independent-support counts twice.

### Feature 2.5 - Classification evaluation

Tasks:

- Hand-label a small stratified development set without using sample output categories as truth.
- Include misleading subjects, quoted replies, absent attachments, spam, and near-duplicate language.
- Track per-class precision, recall, F1, macro-F1, AI fallback rate, and deterministic coverage.
- Version prompts, thresholds, and seed data alongside each evaluation result.

### Stage 2 exit gate

- All 520 emails receive a valid category or an explicit processing failure.
- Deterministic decisions show matched phrases and scores.
- AI decisions show validated evidence.
- A repeat run demonstrates cache hits or fewer AI calls without changing valid outputs unexpectedly.

## Stage 3 - Multi-format document identification, extraction, normalization, and comparison

### Goal

Reliably process TXT, PDF, DOCX, and XLSX attachments, extract the required fields with evidence, and make the final decision in deterministic code.

### Feature 3.1 - Parser adapter layer

Tasks:

- Give every parser the same output contract: text blocks/cells, location metadata, warnings, readability score, and detected MIME type.
- Detect file type from both extension and file signature; do not trust client-supplied MIME alone.
- TXT: decode UTF-8 with replacement detection and preserve line numbers.
- DOCX: extract paragraphs and table cells in reading order; retain paragraph/table coordinates.
- XLSX: inspect all non-empty sheets and cells; retain sheet name and cell range. Avoid flattening away row/column relationships.
- PDF: extract embedded text page by page. Mark pages as potentially scanned when text is empty or implausibly sparse.
- Keep raw files out of MongoDB; store hashes and controlled file paths or object-storage references.
- Enforce file-size, page-count, sheet-count, and decompression limits.

Acceptance criteria:

- A representative file of each dataset format yields readable content and location metadata.
- Parser failures distinguish unsupported, corrupt, encrypted, empty, and scanned inputs.
- Binary formats are never passed through `buffer.toString('utf-8')`.

### Feature 3.2 - Attachment role identification

Tasks:

- Score SI/BL roles using filename patterns and document headers/content.
- Require one unique SI and one unique BL before field comparison.
- Use structured AI role detection only if rule scores are ambiguous.
- Verify model evidence exists in parsed text or the source file.
- Map failure conditions using this precedence:
  1. Fewer than two required attachment references: `missing_attachment`.
  2. Referenced file cannot be read or parsed: `unreadable`.
  3. Files are readable but are not one SI and one BL: `wrong_doc_type`.
  4. Correct documents lack a required extractable value: `missing_value`.

Acceptance criteria:

- Filename-only, content-only, swapped-order, misleading-name, and duplicate-role cases are tested.
- Ambiguity never silently becomes a guessed document role.

### Feature 3.3 - Seven-field rule extraction

Tasks:

- Implement an alias registry for:
  - `shipper`
  - `consignee`
  - `notify_party`
  - `port_of_loading`
  - `port_of_discharge`
  - `container_count`
  - `gross_weight_kg`
- Parse label/value pairs using colon, table, adjacent-cell, and heading/block patterns.
- For party fields, extract the primary organization name separately from the address block; retain the full block as evidence.
- Capture all candidates when a label repeats and resolve only with an explicit deterministic rule.
- Store raw value, normalized value, source label, evidence, location, method, and confidence.
- Never learn shipment-specific values such as `Port Klang` as field labels.

Acceptance criteria:

- Every accepted value is traceable to a source line, cell, paragraph, or page.
- A missing field stays missing; the parser does not copy a nearby unrelated value.

### Feature 3.4 - AI/vision extraction fallback

Tasks:

- Invoke AI only for missing or ambiguous document roles/fields, not for fields already extracted with high confidence.
- Send the smallest necessary evidence: relevant parsed text blocks first, original file only when layout or scanning matters.
- For PDFs, use a vision-capable file-input path when embedded text is absent or layout is essential.
- For DOCX and XLSX, prefer local extraction first; file input is a fallback for unfamiliar structure.
- Require structured output with the seven known field names, source labels, exact evidence, and missing-field flags.
- Validate each text claim against extracted content when possible; if it cannot be verified, lower confidence and send to review.
- Cache by input hash, model, prompt version, and schema version.

Acceptance criteria:

- AI cannot invent an eighth field or silently fill an absent value.
- Empty/scanned, corrupt, and ambiguous cases have distinct visible outcomes.
- Identical fallback requests use the cache.

### Feature 3.5 - Normalization

Implement field-specific pure functions:

| Field group | Normalization rule |
| --- | --- |
| Party names | Unicode NFKC, uppercase, collapse whitespace, standardize harmless punctuation and separators; retain original display value |
| Ports | Prefer validated UN/LOCODE when present; otherwise use a small explicit alias map and normalized text |
| Container count | Parse and sum counts such as `6 x 40'HC`; store integer count separately from equipment type |
| Gross weight | Remove thousands separators, parse decimal safely, convert KG/MT/ton units to kilograms, and reject unknown units |

Guardrails:

- Do not delete meaningful words merely to force equality.
- Do not use fuzzy equality as a silent match. A high-similarity but non-equal party/port can become review rather than `OK`.
- Define a documented numeric tolerance only if data inspection proves it is required.
- Unit-test every normalizer with formatting variants, malformed values, zero, decimal, and thousands separators.

### Feature 3.6 - Deterministic comparison and submission row

Tasks:

- Treat SI as the reference.
- Compare only normalized values from the same canonical field.
- If all seven fields are confidently present, return:
  - `OK` when all match.
  - `MISMATCH` when one or more differ.
- Populate `defect_fields` in the canonical seven-field order, not discovery order.
- Populate `field_details` from original display values for mismatched fields only.
- Return `NEEDS_REVIEW` if document identity, readability, or any required value remains unresolved.
- Ensure retries replace a previous result atomically rather than appending conflicting decisions.

Acceptance criteria:

- `email_004` flags only `consignee` and `notify_party` with SI and BL values.
- Formatting-only differences do not create defects.
- A missing value can never become a mismatch or an `OK` result.
- AI never directly sets the final status.

### Stage 3 exit gate

- TXT, PDF, DOCX, and XLSX representative cases complete end to end.
- All comparison decisions have seven-field evidence or a permitted review reason.
- Normalization and comparison have high-coverage unit tests.
- The exporter can produce a schema-valid row for every processed state.

## Stage 4 - Human review, explainable UI, and operational learning

### Goal

Turn the processing engine into a useful operations product and demonstrate that uncertainty is handled safely instead of hidden.

### Feature 4.1 - Dashboard and inbox

Build:

- Summary cards: total, processing, OK, mismatch, needs review, failed, and AI fallback count.
- Run-progress panel with live polling, elapsed time, and retry controls.
- Searchable/filterable email table by category, status, review reason, file type, and method.
- Clear status colors plus text/icons so meaning is not color-dependent.
- Empty, loading, partial-error, and offline states.

Acceptance criteria:

- A judge can understand the batch state within ten seconds.
- Every summary count links to its filtered email list.

### Feature 4.2 - Explainable email detail

Build:

- Original sender, subject, body, and attachment list.
- Classification method, category scores, explanation, and evidence phrases.
- SI/BL role decision and parser warnings.
- Seven-row comparison table showing SI raw value, BL raw value, normalized values, match state, and evidence location.
- Expandable source-evidence panel instead of dumping entire documents by default.
- Processing timeline showing rule, AI, cache, human, retry, and learning events.

Acceptance criteria:

- A reviewer can answer "why was this classified and flagged?" without reading logs.
- Mismatches are visible side by side as required by the problem statement.

### Feature 4.3 - Review queue and correction workflow

Suggested API:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/reviews` | List unresolved cases |
| `GET` | `/api/reviews/:id` | Get evidence and attempts |
| `PATCH` | `/api/reviews/:id` | Confirm or correct and resolve |
| `POST` | `/api/emails/:emailId/retry` | Reprocess after correction/config change |

Build:

- Queue grouped by `review_reason` and processing stage.
- Reviewer actions to correct category, SI/BL role, or field value.
- Required note when overriding source-derived information.
- A preview of the new deterministic comparison before save.
- Immutable audit trail and a reversible knowledge-base update option.
- Retry after resolution and visible success/failure feedback.

Acceptance criteria:

- Resolving a missing value reruns comparison and updates export output.
- A correction never modifies the raw source document.
- Review history remains visible after reprocessing.

### Feature 4.4 - Knowledge-base visibility

Build a compact admin view showing:

- Category phrases, document labels, and field aliases.
- Status, weight, support/conflict counts, provenance, and last use.
- Promote, block, retire, and restore actions.
- A diff/audit view for automatic learning events.

Acceptance criteria:

- Judges can see that "adaptive" means a real persisted mechanism, not a prompt claim.
- Unsafe or incorrect learned entries can be disabled without database editing.

### Feature 4.5 - Cost, latency, and value metrics

Track per run:

- Deterministic coverage percentage.
- AI fallback count by stage.
- Cache-hit rate.
- Average and p95 processing time.
- Token usage and estimated cost when available.
- Review rate and resolution rate.
- Before/after AI-call count for a repeated run using learned knowledge.

These metrics provide evidence for innovation, technology integration, feasibility, and practical value.

### Stage 4 exit gate

- The main judge journey is usable: start run -> inspect mismatch -> resolve review -> export result.
- Every failure state is visible and retryable.
- At least one learning event can be demonstrated with before/after evidence.

## Stage 5 - Validation, cloud deployment, hardening, and submission readiness

### Goal

Make the prototype credible, publicly accessible, measurable, and ready for the required video, repository, live link, and documentation submission.

### Feature 5.1 - Automated test suite

Add:

- Unit tests for normalizers, phrase scoring, learning validation, output serialization, and review-reason precedence.
- Parser fixture tests for TXT, PDF, DOCX, and XLSX.
- Contract tests for every API route and every AI schema.
- Integration tests for representative `OK`, `MISMATCH`, `NEEDS_REVIEW`, and non-BL cases.
- A batch invariant test asserting that export contains exactly the source email IDs, no more and no fewer.
- A regression fixture set for every bug found during scoring.

Minimum high-risk cases:

- Misleading subject but clear body.
- Quoted thread text that conflicts with the latest message.
- One attachment, missing file, swapped SI/BL order, duplicate SI, and wrong document.
- Formatting-only party/port differences.
- `22 MT`, `22,000 KG`, and `22000kg` normalization.
- Multiple container rows that must be summed.
- Empty-text scanned PDF.
- AI timeout, invalid schema, refusal, and rate limit.

### Feature 5.2 - Evaluation loop

Tasks:

- Generate a complete submission JSON after every material pipeline change.
- Validate locally before calling an organizer self-evaluation endpoint.
- If the endpoint is available, record overall score, Stage-1 macro-F1, Stage-3 defect-F1, and review behavior by pipeline version.
- Investigate source evidence before changing logic to chase a score.
- Keep an evaluation log explaining each change and whether it helped.
- Freeze prompts, seed knowledge, thresholds, and model configuration before recording final demo metrics.

Success targets for the hackathon build:

- 100% email-ID coverage and 100% output-schema validity.
- Zero silent processing failures.
- Correct end-to-end behavior on all hand-labeled regression fixtures.
- Measured deterministic coverage and AI fallback rate.
- A repeatable command that regenerates the submission artifact.

### Feature 5.3 - Security and reliability hardening

Tasks:

- Restore/provide a safe `.env.example`; never commit real API or database secrets.
- Align README configuration claims with the actual Compose requirements.
- Validate upload size, count, extension, MIME, and signature.
- Sanitize filenames and block path traversal and archive/decompression abuse.
- Redact email addresses, phone numbers, and document content from routine logs.
- Apply CORS allowlist, JSON size limit, request IDs, centralized error handling, and basic rate limiting.
- Add graceful timeouts and cancellation for model/file operations.
- Pin dependencies through lockfiles and run dependency/security checks.
- Ensure exported data never includes stack traces, prompts, or secrets.

### Feature 5.4 - Cloud deployment

Required topology:

- Public frontend hosting for the React build.
- Public Node/Express service for APIs and batch processing.
- MongoDB Atlas, or another managed MongoDB service, for email results, review cases, runs, and the adaptive knowledge base.
- Provider secret storage for `OPENAI_API_KEY`, `MONGO_URI`, `CLIENT_ORIGIN`, and `OPENAI_MODEL`.
- Persistent controlled storage for uploaded/source documents if the deployment accepts new files; do not rely on an ephemeral container filesystem.
- Health/readiness endpoint that checks API and database without exposing secrets.

Deployment checklist:

- Use production builds, not Vite or Nodemon development servers.
- Set exact frontend/backend origins and HTTPS URLs.
- Seed knowledge once and make it idempotent.
- Run a smoke dataset after deployment.
- Verify the live link from a logged-out/incognito browser.
- Keep a local fallback demo recording in case venue connectivity is poor.

### Feature 5.5 - Documentation and demo package

Update `README.md` with:

- Problem, solution, architecture, and why deterministic-first plus AI fallback is valuable.
- Exact local setup and environment variables.
- How to run a dataset batch, inspect reviews, and export a submission.
- Supported formats and known limitations.
- Test and evaluation commands.
- Cloud architecture and live demo link.
- Privacy/security notes.

Prepare the required submission assets:

- Project summary.
- Public GitHub repository with clear setup instructions.
- Public functional prototype.
- Slide deck/documentation covering architecture, implementation, challenges, and roadmap.
- Demo video no longer than five minutes.

Recommended five-minute demo flow:

1. 0:00-0:25 - Team, project name, and operational problem.
2. 0:25-0:55 - Architecture and deterministic-first/AI-fallback concept.
3. 0:55-2:35 - Start a run, show classification, inspect an SI/BL mismatch with evidence.
4. 2:35-3:30 - Show a hard PDF/DOCX/XLSX or scanned case and human review/retry.
5. 3:30-4:15 - Show adaptive phrase/alias learning and reduced AI usage on rerun.
6. 4:15-4:45 - Show metrics, complete submission export, and cloud deployment.
7. 4:45-5:00 - Impact and future roadmap.

### Stage 5 exit gate

- Production URL works from a clean browser session.
- Final submission export passes schema and email-ID completeness checks.
- README, slides/documentation, repository link, prototype link, and video link are ready and public.
- A tagged commit or release identifies the exact demoed version.

## 7. API response guidance

Use a consistent envelope for operational APIs:

```json
{
  "data": {},
  "error": null,
  "meta": {
    "requestId": "..."
  }
}
```

For errors:

```json
{
  "data": null,
  "error": {
    "code": "DOCUMENT_UNREADABLE",
    "message": "The draft BL could not be read.",
    "retryable": true
  },
  "meta": {
    "requestId": "..."
  }
}
```

Suggested read/export APIs:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/emails` | Paginated/filterable inbox results |
| `GET` | `/api/emails/:emailId` | Full decision, evidence, and comparison |
| `GET` | `/api/runs/:runId/submission` | Download exact submission JSON |
| `GET` | `/api/knowledge` | Inspect phrases and aliases |
| `PATCH` | `/api/knowledge/:id` | Promote, block, retire, or restore |

## 8. API path implementation summary

All application routes should use the `/api` prefix, JSON request/response bodies unless noted otherwise, and the response envelope defined above. Route handlers should remain thin: validate the request, call one service, map the service result to an HTTP response, and pass unexpected errors to centralized error middleware.

### System and dashboard

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/` | Confirm that the API process is reachable | None | `200` with service name, build version, and a short running message | Existing / P0 |
| `GET` | `/health` | Readiness check for deployment | None | `200` when API and MongoDB are ready; `503` when a required dependency is unavailable | Existing, extend in Stage 5 / P0 |
| `GET` | `/api/dashboard/summary` | Return counts for the dashboard | Query: required `runId` | `200` with totals by category, status, review reason, processing state, and AI method | Stage 4 / P0 |

The health route must not expose connection strings, API keys, stack traces, document contents, or detailed infrastructure topology.

### Processing runs

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/runs` | Import the selected source and start asynchronous batch processing | JSON: `source` (`bundle` initially), optional `forceReprocess` | `202` with `runId`, initial state, counts, and progress URL | Stage 1 / P0 |
| `GET` | `/api/runs` | List processing runs | Query: `page`, `limit`, optional `status`; default newest first | `200` with paginated run summaries | Stage 1 / P0 |
| `GET` | `/api/runs/:runId` | Poll one run's state and progress | Path: `runId` | `200` with state, counters, timings, configuration versions, and latest errors | Stage 1 / P0 |
| `POST` | `/api/runs/:runId/retry` | Retry failed or review items within a run | JSON: optional `emailIds`, `processingStates`, `reviewReasons`; empty body means all retryable items | `202` with retry operation ID and affected count | Stage 1, extend in Stage 4 / P0 |
| `GET` | `/api/runs/:runId/metrics` | Return technical and value metrics for a run | Path: `runId` | `200` with deterministic coverage, AI fallbacks, cache hits, latency, usage, mismatches, and review rates | Stage 4 / P1 |
| `GET` | `/api/runs/:runId/submission` | Validate and download the exact hackathon submission JSON | Query: optional `download=true` | `200` with JSON keyed by every email ID; `409` if the run is not exportable | Stage 3 / P0 |
| `POST` | `/api/runs/:runId/submission/validate` | Run completeness and schema checks without downloading | Path: `runId` | `200` with `valid`, expected/actual ID counts, and validation errors | Stage 3 / P0 |

Run behavior:

- `POST /api/runs` must return quickly and continue processing outside the request lifecycle.
- Starting the same source with the same pipeline version must not create duplicate email records.
- A conflicting active run should return `409` with its existing `runId`, unless the request explicitly allows a separate run.
- Retry routes must create audit events and update results atomically.
- Submission export must fail closed if IDs are missing, duplicated, unknown, or schema-invalid.

### Emails and comparison results

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/emails` | List classified and processed emails | Query: required `runId`; optional `page`, `limit`, `search`, `category`, `status`, `reviewReason`, `fileType`, `method`, `processingState`, `sort` | `200` with paginated lightweight email rows and filter totals | Stage 2, extend in Stage 4 / P0 |
| `GET` | `/api/emails/:emailId` | Get the complete explainable result for one email | Query: required `runId`; path: `emailId` | `200` with source email, classification evidence, attachments, extracted fields, comparison, timeline, and review link | Stage 1, extend in Stages 2-4 / P0 |
| `POST` | `/api/emails/:emailId/retry` | Reprocess one email using the current pipeline/knowledge versions | JSON: optional `fromStage` (`classification`, `document_type`, `extraction`, or `comparison`) and optional `reason` | `202` with operation ID and previous/current result versions | Stage 4 / P0 |
| `POST` | `/api/emails/analyse` | Process one ad hoc email for demo or debugging without starting the full bundle | `multipart/form-data`: one `email` JSON file/part and zero or more `attachments` parts | `202` with generated/imported `emailId`, operation ID, and status URL | Stage 3 / P1 |

Email-list responses must not include full document text or large evidence blocks. The detail route may return evidence snippets, but raw binary downloads should not be exposed by default.

The current singular route `POST /api/email/analyse` should be replaced by the plural `/api/emails/analyse`. If temporary compatibility is needed, retain the old route only as a deprecated alias and remove it before the final release.

### Human review

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/reviews` | List review cases | Query: required `runId`; optional `page`, `limit`, `state`, `reviewReason`, `stage`, `emailId`, `sort` | `200` with paginated review summaries and reason counts | Stage 4 / P0 |
| `GET` | `/api/reviews/:reviewId` | Get one review case with source evidence and processing attempts | Path: `reviewId` | `200` with evidence, suggestions, errors, retry history, and current resolution state | Stage 4 / P0 |
| `PATCH` | `/api/reviews/:reviewId` | Confirm or correct a category, document role, or field and resolve the case | JSON: `action`, corrected values as applicable, `note`, and `updateKnowledgeBase` | `200` with resolved case, recalculated result, export impact, and audit event ID | Stage 4 / P0 |
| `POST` | `/api/reviews/:reviewId/reopen` | Reopen an incorrectly resolved case without deleting its history | JSON: required `reason` | `200` with reopened state and audit event ID | Stage 4 / P1 |

Review updates must use optimistic concurrency, for example an expected record version, and return `409` if another reviewer has changed the case. The service must show a comparison preview before committing any correction that changes the submission output.

### Adaptive knowledge base

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/knowledge` | Inspect learned and seeded phrases/aliases | Query: `page`, `limit`, optional `kind`, `target`, `status`, `search`, `sort` | `200` with entries, provenance summaries, support/conflict counts, weights, and totals | Stage 4 / P1 |
| `GET` | `/api/knowledge/:knowledgeId` | Inspect one entry and its full evidence/audit history | Path: `knowledgeId` | `200` with sources, decisions, conflicts, uses, and state changes | Stage 4 / P1 |
| `PATCH` | `/api/knowledge/:knowledgeId` | Promote, block, retire, restore, or adjust an entry | JSON: `action`, required `reason`, optional constrained `weight` | `200` with the updated entry, knowledge version, and audit event ID | Stage 4 / P1 |

Knowledge seeding should be an idempotent deployment/CLI operation rather than a public HTTP endpoint. Automatic learning must call the same service-level validation and audit logic used by these routes.

### Audit trail

| Method | Path | Purpose | Request | Success response | Stage / priority |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/audit-events` | Retrieve the processing and decision timeline used by detail/admin views | Query: at least one of `runId`, `emailId`, `reviewId`, or `knowledgeId`; optional `page`, `limit`, `eventType` | `200` with immutable chronological events | Stage 4 / P1 |

Audit events are append-only through internal services. No public create, update, or delete audit routes should be implemented.

### Common HTTP behavior

| Status | Use |
| --- | --- |
| `200 OK` | Successful synchronous read, validation, patch, or export |
| `202 Accepted` | Batch, retry, or analysis work accepted for asynchronous processing |
| `400 Bad Request` | Malformed JSON, invalid query combination, or bad multipart request |
| `404 Not Found` | Run, email, review case, or knowledge entry does not exist |
| `409 Conflict` | Duplicate/active run, stale review version, non-exportable run, or invalid state transition |
| `413 Content Too Large` | Email or attachment exceeds configured limits |
| `415 Unsupported Media Type` | Unsupported or signature-mismatched attachment |
| `422 Unprocessable Content` | Well-formed request fails a domain/schema rule |
| `429 Too Many Requests` | API rate or concurrency limit exceeded; include retry guidance |
| `500 Internal Server Error` | Unexpected application fault with a safe request ID |
| `503 Service Unavailable` | Required database, AI provider, or processing dependency is unavailable |

### API implementation checklist

- Define Zod schemas for path parameters, query parameters, bodies, multipart metadata, and responses.
- Add pagination caps and stable sorting to every list route.
- Use one centralized async error handler and error-code registry.
- Add request IDs and structured, redacted server logs.
- Add route-level integration tests for success, validation error, not found, conflict, and service failure.
- Generate or maintain an OpenAPI document from the implemented contracts.
- Keep AI-provider request/response formats private behind `openaiService.js`; never expose them as the public API contract.
- Return URLs/IDs for polling asynchronous work rather than holding HTTP connections open.
- Verify all P0 routes against the deployed origin before recording the demo.

## 9. Test and acceptance matrix

| Capability | Primary tests | Demo evidence | Done when |
| --- | --- | --- | --- |
| Inbox ingestion | 520 IDs, path safety, idempotent import | Run count | Every source email is represented once |
| Classification | Per-class fixtures, misleading subject, quoted thread | Category scores and evidence | Valid category for every email |
| AI fallback | Schema, timeout, refusal, retry, cache | One ambiguous email | No unvalidated model result is used |
| Phrase learning | Exact substring, stoplist, conflicts, duplicate support | Before/after rerun | Learning is persisted, bounded, and reversible |
| Attachment roles | Missing, swapped, duplicate, wrong type | Role evidence | Exactly one SI and BL or valid review reason |
| Parsing | TXT/PDF/DOCX/XLSX, scanned/corrupt | Hard-format example | Parser returns content/evidence or explicit failure |
| Extraction | Alias, table, multiline, repeated labels | Seven-field table | Accepted values have source evidence |
| Normalization | Party, port, container, KG/MT variants | Raw vs normalized | Formatting does not create false defects |
| Comparison | OK, one/many mismatch, missing value | Side-by-side mismatch | Decision is deterministic and SI-referenced |
| Human review | Correct, save, retry, audit | Resolve one case | Outcome and export update without changing source |
| Submission | Schema, enum, exact ID set, deterministic order | Download JSON | Validator passes with all 520 IDs |
| Deployment | health, cold start, CORS, clean browser | Public live link | Judge can use it without local setup |

## 10. Priorities and cut line

### P0 - Must work before submission

- Batch ingestion and all-email output coverage.
- Five-way classification with validated AI fallback.
- TXT parsing and deterministic seven-field comparison.
- Exact submission export and schema validation.
- Basic dashboard, mismatch detail, review reason, and retry visibility.
- Cloud database, public frontend/API, README, and demo flow.

### P1 - Strongly preferred because the provided dataset contains these formats

- PDF, DOCX, and XLSX parsers.
- Scanned-PDF/vision fallback.
- Phrase and field-alias persistence with guarded learning.
- Human correction flow and audit trail.
- Metrics showing deterministic coverage and reduced AI use.

### P2 - Stretch after the scored path is stable

- Authentication and multi-user roles.
- Real email-provider integration.
- Distributed job queue and horizontal workers.
- External object storage and retention controls.
- Notifications, collaboration comments, and advanced analytics.

Cut rule: if a P1 feature threatens the complete 520-email export, preserve the P0 path, return an honest `NEEDS_REVIEW` for unsupported hard cases, and document the limitation.

## 11. Team execution model

Assign these workstreams in parallel and combine them for smaller teams:

| Workstream | Owns | First integration obligation |
| --- | --- | --- |
| Pipeline/backend | Contracts, ingestion, orchestration, models, export | Provide stable mocked API responses immediately |
| Classification/AI | Rules, prompts, schemas, learning, cache | Deliver classifier behind one service interface |
| Document intelligence | Parsers, role detection, extraction, normalization, comparison | Deliver one TXT golden path before other formats |
| Frontend/product | Dashboard, detail, review queue, knowledge UI | Build against mock contracts, then switch to API |
| Quality/deployment | Fixtures, tests, metrics, CI, cloud, docs/demo | Automate schema/coverage gate from the first run |

Collaboration rules:

- Keep `main` deployable and merge small vertical changes.
- Put all cross-layer enums and schemas in one authoritative server module and mirror only generated/explicit frontend display metadata.
- Require fixtures and acceptance evidence in each feature pull request.
- Do not change a shared response shape without updating schema, test, frontend, and documentation in the same change.
- Freeze new features before the deadline; use the remaining time for regression, deployment, video, and links.

## 12. Recommended implementation order under deadline pressure

The five stages remain the architectural sequence, but team members should overlap work as follows:

1. Backend establishes contracts, import, and mocked result endpoints while frontend builds the shell and detail table.
2. Classification and document teams share the same structured AI client, cache, validation, and error taxonomy.
3. Finish TXT end to end before adding PDF/DOCX/XLSX adapters.
4. Once export covers all 520 IDs, lock that invariant in CI.
5. Add advanced parsers and review UX without changing the final submission contract.
6. Deploy early, then continue against the public environment.
7. Freeze, record metrics, rehearse the five-minute demo, and submit with time for link-permission checks.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI output is inconsistent | Invalid classifications/extractions | Strict structured outputs, local validation, retries, review fallback |
| AI usage is too slow or costly | Batch misses deadline | Deterministic thresholds, per-email call budget, concurrency cap, hash cache |
| Auto-learning poisons rules | Accuracy degrades over time | Probation weights, duplicate-source protection, conflict counts, audit/rollback |
| Binary parser loses layout | Wrong field values | Preserve tables/cells/pages; use file/vision fallback only for uncertain fields |
| Normalization hides a real defect | False OK result | Conservative field-specific rules; uncertain similarity goes to review |
| Missing/corrupt inputs crash run | Incomplete output | Per-email isolation, reason precedence, retryable review cases |
| Batch request times out | No usable demo | Asynchronous run record and progress polling |
| Cloud filesystem is ephemeral | Attachments disappear | Bundle at build time for demo or use persistent object storage |
| Secrets leak in repo/logs | Security/disqualification risk | Secret manager, safe env example, redaction, history check |
| README and deployment diverge | Judges cannot run project | One verified clean setup path and deployment smoke test |
| Scope expands into auth/email integration | Core flow remains incomplete | Keep those features P2 until scoring path and export are stable |

## 14. Definition of done

The hackathon prototype is done when:

- A clean environment can start or access the application using documented steps.
- A run ingests all 520 emails without duplicate records.
- Every email has one valid category.
- Every `BL_COMPARISON` has an `OK`, `MISMATCH`, or permitted `NEEDS_REVIEW` result.
- Every accepted extracted field has source evidence and a deterministic normalized value.
- Every mismatch is calculated by application code and shown SI-versus-BL in the UI.
- Every uncertain/failing case is visible, reasoned, and retryable.
- The adaptive knowledge base is persisted, explainable, bounded, and reversible.
- The exported JSON contains exactly all source email IDs and passes the submission schema.
- Tests cover the critical normalizers, decisions, schemas, and representative file types.
- The public deployment, README, documentation/deck, and five-minute video are accessible to judges.
- The team can demonstrate measured accuracy/coverage, latency, review rate, and reduced AI usage over a repeated run.

## 15. Post-hackathon roadmap

After the competition, extend the same boundaries rather than rewriting the prototype:

- Connect Microsoft Graph/Gmail ingestion behind the existing inbox repository interface.
- Move processing to a durable cloud queue with independent workers.
- Store documents in encrypted object storage with explicit retention policies.
- Add organization/user roles, SSO, reviewer assignment, and approval workflows.
- Expand extraction to additional shipping documents and fields through versioned schemas.
- Add multilingual classification and extraction evaluation.
- Introduce formal labeled datasets, drift monitoring, shadow evaluation, and safer promotion rules.
- Add webhook/notification integration and operations reporting.
- Package comparison evidence as an auditable discrepancy report for downstream shipping workflows.
