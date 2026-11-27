# Academic year: keep the term value, remove the offering copy

Academic year is not redundant on `AcademicTerm`. It groups Winter, Spring and Summer correctly even when they fall in different calendar years; the application uses it for transcript years, finance filters, term identity (`academicYear` + `season`) and selecting previous offerings to copy. The requirements explicitly include it in term-specific offering information. A term code such as `61-` and a date alone are not substitutes for that grouping.

The independent `CourseOffering.academicYear` was redundant: every offering already has one required term reference, the unique offering key is `(term, course)`, and no active feature filters or groups by the separate stored copy. Create/update APIs and forms nevertheless allowed the copy to disagree with the term.

The offering create/edit forms now get the year from the selected term. The term-year edit on Academic terms, transcript-year picker, finance filters and source-year/season offering-copy selector remain. Portal Folio styles and layout components are unchanged.

New offerings do not persist a year. A read-only model virtual preserves the top-level `academicYear` response property when the term is populated, using the term's current value. Existing stale stored copies cannot override the response. Offering-copy responses also derive the year from the target term. Older API clients may still submit the matching year; a conflicting year is rejected instead of stored. Seed scripts no longer write duplicate offering years.

## Existing databases

The code works with old records immediately; cleaning up old raw fields is optional and not run automatically on an application database. This avoids introducing a startup migration or changing an unspecified database.

With `MONGODB_URI` pointing to the intended database:

```sh
npm run migrate:offering-years
npm run migrate:offering-years -- --apply
```

The first command only reports redundant fields, mismatches and missing term references. The second removes the obsolete copies and their single-field year index. It preserves term records, offerings, slot data and the unique `(term, course)` index. Cleanup refuses to apply if legacy records with stored years have missing terms, and can be rerun safely. Repair those term references first.

## Validation

`npm run test:offering-year` covers new storage, legacy caller compatibility, rejecting year conflicts, editing other offering metadata, changing the term year, legacy mismatched records, copy-to-target behavior, cleanup dry run/apply/idempotence, orphan refusal, scheduling and transcript/PDF/model regression tests. The frontend production build also passes.
