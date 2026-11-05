# Build Prompts

Run these in order, one at a time. Each one ends with a working app and a commit. Rules live in `CLAUDE.md` and `DESIGN.md`, so the prompts stay short.

**Add this to every prompt:** Follow CLAUDE.md and DESIGN.md. Keep it simple. Run tests, typecheck and lint, then commit using conventional commits.

## Status

- [x] 0. Setup: docs, scaffold, schema, sample data, refund and instalment rules
- [x] 1. Sample data
- [x] 2. Sign-in and consent
- [x] 3. Parent home and payment
- [x] 4. Fee ledger
- [x] 5. Reminders
- [x] 6. Refund calculator
- [x] 7. Dues dashboard
- [ ] 8. Dropout-risk flag
- [ ] 9. Polish check
- [ ] 10. Submission files

## 1. Sample data

> Extend `src/db/seed.ts` so the app never looks empty. Keep the three brief students exactly as they are. Add about 40 fictional students across 4 centres and several batches, with a mix of paid, part-paid and overdue instalments in every ageing bucket, a few discounts, attendance, test scores and one unmatched payment. Include 2 or 3 students whose records should trigger the risk flag, and one with too little data. Use a fixed random seed.

## 2. Sign-in and consent

> Build OTP sign-in for parents and staff. Mock the SMS: show the code on screen in demo mode only. Limit attempts, expire codes, and use signed httpOnly session cookies. Add role checks in one shared helper. Let the parent pick Hindi or English before entering their number. Show the consent screen once, record it in `consents`, and block student data until it is given. Test expiry, attempt limits and role checks.

## 3. Parent home and payment

> Build parent home to the Screen Plan in DESIGN.md: name, amount, one status line, pay button, one link to instalments. Handle more than one child. Add a mock gateway page that sends a signed webhook to our server. The webhook is what marks an instalment paid, and it must be safe to receive twice. A webhook that matches no instalment or the wrong amount goes to the unmatched queue and marks nothing paid. Add a printable receipt showing GST. Test matching, duplicates, part payments and unmatched cases.

## 4. Fee ledger

> Build the staff student list and the student ledger: plan, discount, instalments, payments, balance, days overdue. Add recording a manual payment, using the same matching code as the webhook. Show a clear empty state when search finds nothing.

## 5. Reminders

> Add `domain/reminders.ts` to work out which reminders are due, then a job that sends them through a mock sender in the parent's language. Run it from a protected cron route and from a "Run reminders" button. Re-check the balance at send time, so a paid instalment is marked stopped and never sent. Build the reminders screen showing sent, stopped and queued. Test every stage, part payments and that paying stops reminders.

## 6. Refund calculator

> Build the refund screen on top of `domain/refund.ts`. Pick an exit date, then see every working line, the result and the 10-day deadline. Saving records the refund and stops future reminders for that student. Add the public refund policy page in Hindi and English. Cover edge cases: exit before the term, exit after the term, paid less than used, and a discount.

## 7. Dues dashboard

> Build the dues dashboard: totals, ageing buckets and a table by centre and batch, with centre and batch filters. Calculate in `domain/dues.ts` with tests. Add a Tally export as CSV, and state the assumed column format in the TDD. Every number must come from the database.

## 8. Dropout-risk flag

> Add `domain/risk.ts`. Combine missed instalments, attendance trend and test trend into a band (none, watch, high), with the plain reasons shown beside it. If there is too little data, return "not enough data" and create no task. Run it as a job that creates a counsellor call task only, and never a fee action or parent message. Add the tasks screen with "called" and "false flag" actions, and show the false-flag rate. Test the bands, missing data and that no other side effects exist.

## 9. Polish check

> Check every screen at 360px, in Hindi and English, for loading, empty and error states, dead buttons and DESIGN.md mismatches. Fix what you find. Confirm every parent page blocks access to another parent's child. Confirm no secrets are in the repo.

## 10. Submission files

> Write `deployment.md`: run locally step by step, how it is deployed, environment variable names only, demo logins. Draft the Technical Design Document with the GitHub URL at the top, architecture and why, data model, main flows, how the AI part works, UI decisions, assumptions from CLAUDE.md, what was cut and what comes next. Keep the limits honest. Remind me to make the repo public.
