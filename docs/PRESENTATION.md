# Shipmail presentation outline

## 1. The operational problem

Shipping teams receive mixed email categories and inconsistent SI/BL formats. Manual comparison is slow, difficult to audit, and risky when missing values are mistaken for matches.

## 2. The solution

Shipmail processes a batch into five categories, resolves SI/BL document roles, extracts seven required fields, and produces `OK`, `MISMATCH`, or an explicit `NEEDS_REVIEW` reason.

## 3. Architecture

React dashboard → Express operational API → asynchronous processing orchestration → deterministic knowledge and parsers → structured AI fallback and hash cache → deterministic comparison → MongoDB results, reviews, metrics, and audit history.

## 4. Why deterministic-first

- Rules are fast, inexpensive, and explainable for known evidence.
- AI is reserved for uncertainty and constrained by strict schemas and evidence checks.
- AI never directly chooses the final comparison status.
- Human corrections preserve raw sources and can update reversible knowledge.

## 5. Technical evidence

- 74 automated tests.
- TXT, PDF, DOCX, and XLSX fixture coverage.
- Exact 520-ID submission validation.
- Per-attempt AI, cache, token, cost, latency, and review metrics.
- Request IDs, CORS allowlist, bounded bodies, rate limiting, path safety, signature checks, archive limits, and graceful run cancellation.

## 6. Honest learning result

The supplied-data knowledge works well on familiar language but exact sentence-like entries generalize poorly. A 1,000-message external trial produced almost complete AI fallback. The next version will learn bounded concepts/n-grams, aggregate paraphrase support, and evaluate on held-out data without weakening decision thresholds.

## 7. Practical value and roadmap

Near term: improve concept generalization, add authentication and roles, connect a real inbox, and run held-out evaluation. Production path: managed MongoDB, persistent document storage, background workers, secrets management, observability, and public HTTPS deployment.
