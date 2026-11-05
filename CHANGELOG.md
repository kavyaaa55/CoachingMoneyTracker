# Changelog

## Unreleased

### Parents

- Attendance and test scores page in Hindi and English, reached from the instalments page. Parent home is unchanged

### Accounts staff

- Bulk upload of attendance and test scores per batch: CSV, a template per batch, a preview showing old and new values, and errors listed by line
- All-or-nothing saving, and repeat uploads that change nothing
- Uploaded records reach the risk check on its next run

### Quality

- 263 tests: 167 unit and 96 database
- A hands-on test guide in [docs/demo.md](docs/demo.md), with sample files in `docs/samples`

## 1.0.0 (5 Nov 2026)

The first complete version. The core slice from the brief works end to end on sample data.

### Parents

- OTP sign-in with limits on tries and expiry, and language choice before the number
- Verifiable consent, recorded per child, before any student data
- Dues home for one or more children, instalments, and printable receipts showing GST
- Test gateway with a signed webhook, safe to receive twice
- Public refund policy in Hindi and English

### Accounts staff

- Dues dashboard by centre and batch, with ageing and filters
- Unmatched payments queue, read only
- Tally export as CSV, with GST split out
- Student ledger, and manual payments through the same matching code as the webhook
- Reminders screen with a run button
- Pro-rata refund calculator. Saving stops reminders and closes the fee account
- Dropout-risk call tasks with false-flag marking and rate

### Automation

- Reminders in Hindi or English before, on and after each due date, then weekly to 9 weeks late and every 4 weeks after that, stopping on payment
- Payment matching with an accounts queue for anything that does not fit
- Dropout-risk flag from missed instalments, attendance and test trends, which only creates a call task
- Daily jobs on routes protected by a secret

### Quality

- 226 tests: 142 unit and 84 database, run in CI with lint, types and a build
- Every screen checked at 360px in both languages

### Not in this version

- Live deployment. [deployment.md](deployment.md) has an AWS free tier guide
- Parent attendance and test scores, and bulk upload, which the brief lists as optional depth
- Applying an unmatched payment to a fee, reversing a payment or refund, and a "refund paid" step
