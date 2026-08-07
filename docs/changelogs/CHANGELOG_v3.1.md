# CHANGELOG v3.1.0

## Added

- Canonical question metadata aliases for Official Reference, Section, Topic, Book Page, and Primary Concept.
- Complete metadata display in practice feedback and mock-exam review.
- Machine-readable `QA_REPORT_v3.1.json` and human-readable `QA_REPORT.md`.
- Source-data exception reporting for blank explanations and probable OCR contamination.

## Fixed

- Correct-option text is synchronized with the authoritative answer letter and option list.
- Official mock-exam resume now preserves original start time and calculates duration correctly.
- Exam timer is rendered immediately and cannot finish more than once.
- Unanswered-question confirmation before exam submission.
- Full book references and page ranges are displayed consistently.
- Missing metadata is omitted instead of showing placeholder messages.
- Project version and audited counts updated to v3.1.0.

## Preserved

- Existing question wording, answers, and official explanations from the supplied Excel source.
- Existing knowledge-engine architecture and site design.
- Single Source of Truth: no blank official explanation was fabricated.
