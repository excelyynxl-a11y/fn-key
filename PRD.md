# Shipping document verification

**From email inbox to discrepancy report**

## Context

A shipping operations team receives different kinds of messages in the same inbox: requests to check documents, prepare new shipping instructions, answer invoice questions, and share operational updates. Spam arrives alongside them.

For a document-checking request, the team compares a Shipping Instruction (SI), which contains the intended shipment details, with a draft Bill of Lading (BL). The SI is the reference for this check. The goal is to catch incorrect details before the draft is finalized.

## The problems

- **Finding the right emails takes time.** Staff must read each message and decide what action it needs. A document request that is overlooked never reaches the checking step.
- **Manual comparison is repetitive and easy to get wrong.** Names, ports, quantities, and weight must be checked across two documents. A missed discrepancy can lead to corrections, delays, and additional work.
- **The same information can look different.** One document may say "Port of Loading" while the other says "Load Port." The system needs to recognize that these refer to the same field.

## What the system should be able to do

Starting from the inbox, the system should produce a clear result for each email. How you design the workflow is up to you, but it should generally be able to:

| Capability | What it means |
| --- | --- |
| **Classify** | Tell the different kinds of messages apart, including document-comparison requests, new SI requests, invoice queries, general messages, and spam. |
| **Extract data** | For comparison requests, read the SI and BL attachments and identify the corresponding shipment fields. |
| **Compare** | Check the values and surface any mismatched fields, showing the SI and BL values side by side. |
| **Ask for help** | When it cannot complete the task on its own, escalate to a person (human in the loop) with the relevant context, rather than guessing or failing silently. |

The starting version uses JSON email records and plain-text attachments. Other email categories only need to be classified; only document-comparison requests continue to the checking step. The approach used to achieve these capabilities is left to the participant.

## Working with the data

The dataset contains inbox records in JSON, together with the SI and BL attachments referenced by those emails. The answer key is not included. You can check your result using the self-evaluation endpoint described below.

## Categorisation
Build a pipeline that reads this inbox and, for each email, decides:

1. **category** — one of `BL_COMPARISON`, `SI_REQUEST`, `INVOICE_QUERY`,
   `GENERAL`, `SPAM`.
2. for `BL_COMPARISON` emails, compare the **Shipping Instruction (SI)** against
   the **draft Bill of Lading (BL)** attachments and report the outcome:
   - `status`: `OK` (all 7 fields match), `MISMATCH` (≥1 field differs), or
     `NEEDS_REVIEW` (you cannot decide — unreadable/missing/wrong document).
   - `has_defect` + `defect_fields` when it's a `MISMATCH`.
   - `review_reason` when it's `NEEDS_REVIEW`
     (`wrong_doc_type` | `missing_attachment` | `unreadable` | `missing_value`).

The 7 compared fields: **shipper, consignee, notify_party, port_of_loading,
port_of_discharge, container_count, gross_weight_kg**. Note the SI and BL often
*label the same field differently* (`Port of Loading` vs `Load Port`) — align by
meaning, not by header text.



