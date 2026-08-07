# CHANGELOG v3.1.1

## Corrected

- Re-audited the master Excel workbook and confirmed that all 556 records contain a Correct Answer field.
- Corrected the earlier QA classification that confused missing option text with missing answers.
- Restored 16 corrupted answer-to-option links in Mock Exams 4 and 5.
- Restored repeated question option sets from matching authoritative records already present in the supplied workbook.
- Restored PDCA, quantitative risk assessment, and moral-argument terminology for three records using official course terminology and the answer letters present in Excel.
- Rebuilt `Correct Option Text` for every repaired record.
- Added answer verification and repair provenance metadata to repaired JSON records.

## Preserved

- Existing official explanations were not overwritten.
- Blank official explanations were not fabricated.
- Existing question IDs and progress-storage compatibility were preserved.
