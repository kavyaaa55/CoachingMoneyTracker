# Changelog

## Unreleased

### Data pipeline

- Sample data is replayed day by day as events through the real entry points, instead of being written as finished rows
- One daily pipeline, `runDay`, used by the schedule, staff, the replay and the time machine
- Every run is recorded, and a failed stage does not stop the next. New route `/api/cron/daily`

### Reviewer console

- A time machine that runs each day through the real pipeline, with simulated parents and centre files
- A guided story, a preview of sent messages, recent runs and a reset

### Director scoreboard

- The brief's success measures, per rupee and by month and centre. Parent calls are shown as not tracked

### Refund desk

- Every refund against the 10-day deadline, second-person approval, a paid step and a GST credit note in the Tally export
- Parents see the refund status

### Risk lab

- Replays the rule over the term using only what was known each day, with what-if numbers that change nothing live
- Notices students whose records stop, and stores the rule version on each flag

### Close the books

- Month-end checks that add up the finished Tally file against the ledger, and closing a month
- Queue suggestions, applying queued money, and returning it to the payer
- Reversals that keep the record and restart future reminders
- An append-only audit log, enforced by the database
- Receipt and export dates now use India time

### Docs

- A visual guide, key decisions, and mistakes and recovery

### Parents

- Attendance and test scores page in Hindi and English, reached from the instalments page. Parent home is unchanged

### Accounts staff

- Bulk upload of attendance and test scores per batch: CSV, a template per batch, a preview showing old and new values, and errors listed by line
- All-or-nothing saving, and repeat uploads that change nothing
- Uploaded records reach the risk check on its next run

### Quality

- 365 tests: 213 unit and 152 database
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
