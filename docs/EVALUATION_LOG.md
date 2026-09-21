# Evaluation log

## Frozen Stage 5 configuration

- Pipeline: `5.0.0-stage-5`
- Knowledge: `email-phrases-2026-09-21`
- Classification prompt: `email-category-v1`
- Document role prompt: `document-role-v1`
- Document field prompt/schema: `document-fields-v1` / `document-ai-v1`
- Deterministic classification threshold: score `4`, margin `1.5`

These values identify the build being evaluated. Change them only with a new evaluation entry and pipeline version.

## Recorded checks

| Date | Check | Result | Interpretation |
| --- | --- | --- | --- |
| 2026-09-21 | Server automated suite | 74/74 passing | Covers schemas, exact ID invariants, parsers, deterministic comparison, review safety, cancellation, security boundaries, AI failures, and representative end-to-end cases. |
| 2026-09-21 | Client production build | Passed | Vite production bundle compiles successfully. |
| 2026-09-21 | Manually labelled classification development set | 15/15; accuracy 1.0; macro-F1 1.0; deterministic coverage 1.0 | Confirms the five categories on a small, unambiguous development set. It is not a held-out production estimate. |
| 2026-09-21 | Submission artifact validator against challenge IDs | 520 expected / 520 actual; schema valid | Confirms the validator rejects missing, duplicate, unexpected, or malformed output rows. |
| 2026-09-21 | Production dependency audit | 0 known vulnerabilities in client and server production dependencies | Snapshot only; rerun before release. |

No organizer self-evaluation endpoint was supplied, so no organizer score is claimed.

## External-dataset finding

A trial with 1,000 newly worded messages produced almost 100% classification AI fallback. Investigation found four causes:

1. Learned entries match exact normalized substrings rather than semantic concepts.
2. AI evidence can be a sentence up to 12 tokens, so equivalent wording does not reinforce the same entry.
3. New entries begin at weight 2 with a probation multiplier of 0.35 and cannot independently reach the score threshold of 4.
4. Active knowledge is loaded once at the start of a run, so learning does not help later messages in that same batch.

This is an honest generalization limitation, not a reason to lower the safety threshold. The next experiment should derive bounded 2–5-token candidates, aggregate support by canonical concept, refresh knowledge between processing epochs, and compare false positives plus fallback rate on a held-out set.

## Repeatable commands

```sh
cd server
npm test
npm run evaluate:classification
npm run submission:export -- <runId> submission.json http://localhost:5000
npm run submission:validate -- submission.json ../sdoc-hackathon-bundle
npm audit --omit=dev
cd ../client
npm run build
npm audit --omit=dev
```

Record each future material pipeline change here with the pipeline version, dataset, schema validity, ID coverage, deterministic coverage, AI fallback rate, review rate, and any observed regressions.
