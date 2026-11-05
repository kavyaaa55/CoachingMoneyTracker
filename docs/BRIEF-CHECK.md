# Brief Check

Every requirement in [the brief](brief.txt), its status in version 1.0.0, and where to find it. Checked line by line on 5 Nov 2026.

| Status | Meaning |
|---|---|
| Met | Works, with a test or a browser check behind it |
| Partial | Works, with a stated gap |
| Optional | Not built. The brief says this is optional depth |
| Pending | Waiting on an owner action, not on code |

## Core build

| Requirement | Status | Where |
|---|---|---|
| Fee ledger | Met | `/staff/students/[id]`, `src/domain/instalments.ts` |
| Parent portal with dues and pay link | Met | `/parent`, `/gateway/[token]` |
| Reminders that stop on payment | Met | `/staff/reminders`, `src/domain/reminders.ts`, `src/lib/reminders.ts` |
| Refund calculator | Met | `/staff/students/[id]/refund`, `src/domain/refund.ts` |
| Dues dashboard | Met | `/staff/dues`, `src/domain/dues.ts` |
| About 6 to 8 screens | Met | Sign-in, consent, parent home, pay and receipt, dues, ledger, refund, reminders and tasks |
| Roles: parent and accounts executive | Met | `src/lib/auth.ts`, `src/domain/access.ts` |
| AI: dropout-risk flag | Met | `/staff/tasks`, `src/domain/risk.ts`. Rule-based, as TDD section 7 explains |
| Hard part: instalment and pro-rata refund rules | Met | `src/domain/refund.ts`, with unit and database tests |
| Payments, messages and outside systems mocked | Met | Test gateway, mock sender, CSV export |
| Seeded from the sample data | Met | The three brief rows produce the brief's exact statuses, in `src/db/sample-data.test.ts` |

## Must have list

| Requirement | Status | Notes |
|---|---|---|
| Ledger: plan, instalments, discounts, payments, balance, days overdue | Met | |
| OTP login | Met | Hashed, 5 minute expiry, tries and resends limited |
| Portal: dues | Met | |
| Portal: receipts | Met | Reached from each instalment, with no separate list |
| Portal: attendance and test scores | Optional | The data exists and feeds the risk flag. There is no parent page |
| Hindi or English reminders before, on and after, stopping on payment | Met | Needs the daily job scheduled once deployed |
| Payment link per instalment, in test mode, that marks it paid | Met | Signed link and signed webhook |
| Pro-rata refund calculator | Met | |
| Dashboard by centre and batch, with ageing and Tally export | Met | The Tally format is a labelled assumption |
| Bulk upload of attendance and test scores | Optional | |

## AI and automation

| Requirement | Status | Notes |
|---|---|---|
| Reminders are automated | Met | Daily route with a secret, plus a staff button |
| Payment matching is automated | Met | `src/domain/payments.ts` |
| Flag built from missed instalments, attendance and test trends | Met | |
| The flag only creates a counsellor call task | Met | A test confirms fees, payments, reminders, refunds, students, consents and users do not change |
| Never a fee action or parent message | Met | Parent pages hold no risk code |
| Counsellors mark false flags | Met | With a required note and a visible rate |
| Handling when unsure | Met | Too little data says so and creates no task |
| Unmatched payments go to an accounts queue | Partial | Staff can see the queue on Dues, and nothing is marked paid. Applying a payment to a fee is not built |

## Constraints

| Requirement | Status | Notes |
|---|---|---|
| Published refund policy | Met | `/refund-policy`, public, in both languages. Wording is a sample for Company A to confirm |
| Pro-rata refund within 10 days of leaving | Partial | The deadline is worked out and shown on the student's refund screen. There is no list across students, and no "refund paid" step |
| Verifiable parental consent, DPDP Act 2023 | Met | Stored per child with a notice version. Proves control of the phone, not guardianship |
| Receipts show GST | Met | The rate and GSTIN are labelled samples |
| Works on low-end phones | Partial | Designed at 360px and kept flat and light. Not measured on a real low-end phone |
| Hindi required | Partial | On every parent screen and reminder. Wording still needs a native speaker |

## Design

| Requirement | Status | Notes |
|---|---|---|
| Minimal, restrained, nothing without a purpose | Met | [DESIGN.md](../DESIGN.md) |
| Dues understood in five seconds | Met | Amount, due date and pay button |
| Consistent design, works on a phone | Met | 67 screen views checked at 360px |
| Loading, empty and error states | Met | Loading and error pages reviewed in code, not forced in a browser |
| No dead buttons | Met | Checked by script on every screen |

## Success measures

The client's measures need live use, so none can be shown yet. This is what supports each one.

| Measure | What supports it | Gap |
|---|---|---|
| Value over 60 days late, 12% to 6% | Ageing shows it by batch, and reminders continue past 60 days | The dashboard shows what is late now, not the share that arrived late |
| Parent calls about dues down 70% | Parent home and reminders | |
| Month-end reconciliation, 4 days to 1 | Automatic matching and the Tally export | The Tally format needs a trial import |

## Submission rules

| Requirement | Status | Notes |
|---|---|---|
| Frontend, backend, database, sign-in | Met | |
| Tests for the important logic | Met | 226 tests |
| No secrets in the repository | Met | Full history checked |
| Validated inputs and access control | Met | Checked on every read and write |
| Sample data so it does not look empty | Met | 49 fictional students |
| Keep the commit history | Met | |
| Label every assumption | Met | [TDD section 11](TDD.md#11-assumptions) |
| GitHub URL at the top of the TDD | Met | |
| TDD: architecture, data model, flows, AI, UI, cuts, next steps | Met | |
| deployment.md: local run, deployment, variable names, demo logins | Met | |
| Live link | Pending | The owner deploys, using the guide in [deployment.md](../deployment.md) |
| TDD as PDF or Word | Pending | Export once the live link is in |
| Repository public | Pending | The owner makes it public before submitting |

## Out of scope, and kept out

No video lectures or learning platform, no timetables, no admissions CRM.
