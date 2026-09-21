# Five-minute demo script

## 0:00–0:25 — Problem and product

Introduce Shipmail as an operations tool that classifies shipping email, identifies SI and BL documents, compares seven required fields, and exposes uncertainty instead of hiding it.

## 0:25–0:55 — Architecture

Show the deterministic-first flow: weighted persisted knowledge, structured AI fallback, guarded learning, format-specific parsers, deterministic normalization/comparison, MongoDB persistence, review workflow, and exact submission validation.

## 0:55–2:20 — Run and inspect

Start a run. Point out live counts, elapsed time, AI fallback count, the Stop process control, and the collapsible sidebar. Open a mismatch and show sender/body, classification evidence, document roles, raw and normalized field values, source locations, and the timeline.

## 2:20–3:20 — Human review

Open a `NEEDS_REVIEW` case. Correct a category, role, or field; enter the required note; preview the deterministic outcome; save; then show retained history, audit events, retry, and reopen controls.

## 3:20–4:10 — Adaptive and measurable

Open the knowledge panel. Show provenance, support/conflict/usage counts, probation/trusted status, and reversible promote/block/retire/restore actions. Show run metrics: deterministic coverage, AI calls by stage, cache hits, latency, tokens/cost, and review resolution.

State the measured limitation plainly: exact learned phrases do not yet generalize well to a newly worded 1,000-message dataset. Explain the bounded concept-learning experiment described in the evaluation log.

## 4:10–4:45 — Validate output

Export the JSON, run `npm run submission:validate -- submission.json ../shipmail-hackathon-bundle`, and show 520 expected and 520 actual IDs with schema validity.

## 4:45–5:00 — Close

Summarize the value: faster routine verification, evidence-backed decisions, explicit escalation, measurable AI use, and a safe path to broader adaptive knowledge.

## Recording checklist

- Use a seeded database and a known completed run as fallback.
- Keep API keys, database URIs, email addresses, and document contents out of terminal output.
- Record at 1080p, verify text is readable, and keep the final video under five minutes.
- Verify repository and video permissions from a logged-out browser before submission.
