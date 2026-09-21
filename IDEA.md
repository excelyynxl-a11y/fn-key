# Shipmail Adaptive Shipping Document Verification

## Project Idea

Shipmail is an AI-assisted email and shipping-document verification system. It reads each inbox email, identifies its category, and processes document-comparison requests by comparing the Shipping Instruction (SI) against the draft Bill of Lading (BL).

The system follows an adaptive approach:

1. Use deterministic rules and previously learned phrases first.
2. Use AI when the deterministic result is not clear.
3. Automatically learn highly specific phrases and field labels from successful AI decisions.
4. Escalate cases that still cannot be processed reliably.

This reduces repeated AI usage over time while keeping AI available for unfamiliar wording and document formats.

## Required Email Categories

Every email must be classified into one of the categories defined by the project bundle:

- `BL_COMPARISON`
- `SI_REQUEST`
- `INVOICE_QUERY`
- `GENERAL`
- `SPAM`

Only emails classified as `BL_COMPARISON` continue to attachment checking and document comparison.

## Core Workflow

```text
Email received
    ↓
Deterministic email classification
    ↓ unclear
AI classification
    ↓
Automatic phrase learning
    ↓
If BL_COMPARISON: identify SI and BL attachments
    ↓
Extract and normalize seven required fields
    ↓
Compare SI against draft BL
    ↓
Return OK, MISMATCH, or NEEDS_REVIEW
```

## 1. Adaptive Email Classification

The system maintains a cloud-based phrase list for each email category. Each entry can contain a phrase, its occurrence frequency, and a relevance weight.

When an email arrives, the system checks its subject and body against the stored phrases. It calculates a score for each category based on the number, frequency, and importance of the matched phrases.

If one category is clearly stronger than the others, the system classifies the email deterministically. If the result is unclear, the email is sent to the AI classifier.

The AI returns:

- one of the five required categories;
- a short reason for the decision; and
- highly specific phrases copied directly from the email that support the category.

### Automated Phrase Learning

AI-suggested phrases can be added automatically without requiring a person to approve every email. Before saving a phrase, the system checks that it:

- appears exactly in the original email;
- is clearly related to the selected category;
- is sufficiently specific, preferably a meaningful multi-word phrase;
- is not a generic expression such as "please", "attached", or "document";
- does not strongly belong to several different categories; and
- is not already stored under a normalized variation.

Valid phrases are added or have their frequency increased. Newly discovered phrases begin with a lower influence and become more important when they repeatedly support the same category. This makes the learning process automatic while reducing the risk that one incorrect AI decision controls future classifications.

Each category can retain up to approximately 100 of its most useful phrases. Older, weak, or non-discriminative phrases can be replaced by phrases with stronger support.

## 2. SI and BL Attachment Identification

For a `BL_COMPARISON` email, the system checks whether the required SI and draft BL attachments are available.

It first examines attachment filenames and contents using known document-type phrases, such as "Shipping Instruction" and "Draft Bill of Lading". If the attachment types cannot be determined clearly, AI identifies which attachment is the SI and which is the draft BL.

The same adaptive approach can learn new, highly specific document-type labels. These labels must be found in the source attachment before they are stored.

The system continues only when it has identified one SI and one draft BL. Otherwise, the case returns `NEEDS_REVIEW` using the appropriate project reason:

- `wrong_doc_type`
- `missing_attachment`
- `unreadable`
- `missing_value`

## 3. Shipping Document Processing

The SI and draft BL are converted into the same structured format using the seven fields required by the project bundle:

- `shipper`
- `consignee`
- `notify_party`
- `port_of_loading`
- `port_of_discharge`
- `container_count`
- `gross_weight_kg`

The system first uses known field-label mappings to extract values. For example, `Port of Loading`, `Load Port`, and `POL` may all refer to `port_of_loading`.

If a field cannot be extracted through existing mappings, AI identifies the field value and its source label. A new label can be learned automatically when it:

- appears exactly in the document;
- refers clearly to one required field;
- does not conflict with an existing field mapping; and
- is a label rather than a shipment-specific value.

For example, `POL` may be stored as an alias for `port_of_loading`, but `Port Klang` must remain a document value and must not be stored as a field label.

## 4. Normalization and Comparison

Extracted values are normalized before comparison so that formatting differences are not incorrectly reported as defects.

Examples include:

- `Port of Loading` and `Load Port` mapping to the same field;
- `22 MT`, `22,000 KG`, and `22000kg` being converted to `22000` kilograms;
- capitalization, spacing, and harmless punctuation differences being standardized; and
- numeric container counts being converted to a consistent integer format.

After normalization, ordinary deterministic logic compares the SI and draft BL field by field. AI assists with interpretation and extraction but does not make the final match-or-mismatch decision.

The SI is treated as the reference document.

## 5. Report Outcome

For a `BL_COMPARISON` email, the result uses one of the required statuses:

- `OK` - all seven fields match;
- `MISMATCH` - one or more fields differ; or
- `NEEDS_REVIEW` - the system cannot make a reliable comparison.

When a mismatch is found, `has_defect` is set to `true` and `defect_fields` contains the exact snake_case names of the differing fields.

Example:

```json
{
  "email_004": {
    "category": "BL_COMPARISON",
    "status": "MISMATCH",
    "review_reason": null,
    "has_defect": true,
    "defect_fields": ["container_count"]
  }
}
```

If all seven fields match, the result uses `status: "OK"`, `has_defect: false`, and an empty `defect_fields` list.

If the documents cannot be processed reliably, the result uses `status: "NEEDS_REVIEW"` and one of the permitted `review_reason` values.

The final submission must match `sample_submission.json` exactly and include every `email_id` in the dataset.

## Cloud and AI Integration

The cloud database stores:

- category-specific phrases and their frequencies;
- SI and BL document-type phrases;
- aliases for the seven required fields;
- processing results; and
- information needed for cases requiring review.

AI is used as a targeted fallback for:

- unclear email classification;
- uncertain SI and BL attachment identification; and
- unfamiliar field labels or document wording.

This creates meaningful AI and cloud integration while keeping repeated, well-understood cases fast and deterministic.

## Key Value Proposition

Shipmail does more than classify and compare a single batch of emails. It builds a reusable knowledge base from specific phrases and document labels discovered during processing. As the knowledge base grows, more emails and documents can be handled deterministically, reducing AI calls, processing cost, and response time while preserving AI support for unfamiliar cases.

