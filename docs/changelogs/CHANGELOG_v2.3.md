# PSM Prep v2.3 - Question Integrity Baseline

- Removed all generated correct-answer explanations from 396 questions.
- Removed all generated wrong-option rationales.
- The interface no longer inserts fallback explanations.
- Added evidenceLevel, verificationStatus, explanationStatus, referenceStatus and knowledgeTrace to every question.
- Explanations display only when verificationStatus is Verified and officialExplanation is present.
- Until question-by-question verification is complete, the learner sees only the correct answer and available book reference metadata.

This release applies the no-invented-explanation rule. It does not claim that all question references or answers have been verified against the book yet.
