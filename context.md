# Project Handover

Read this first, then continue from **Next step**.

**Last updated:** 5 Nov 2026, after prompt 6.

## What this is

Fee Tracker: a 7-day solo assessment build for Company A, a Jaipur coaching institute. Parents see dues and pay on a phone, in Hindi or English. Accounts staff get ledgers, reminders and refunds. Submission is a zip holding a TDD (PDF or Word) and `deployment.md`.

## Read in this order

1. `CLAUDE.md`: ground rules, hard rules from the brief, assumptions, stack
2. `prompt.md`: build order and status
3. `DESIGN.md`: read before any UI work
4. `docs/brief.txt`: the client brief, which wins over everything else
5. `docs/TDD.md`: architecture, decisions, limits

## Ground rules

- No AI attribution anywhere: no `Co-Authored-By`, no "Generated with" lines, in commits, PRs, code or docs.
- Push from the owner's account, Siddhesh-source, to `main`.
- Conventional commits, one logical change each. Reviewers read the history.
- Keep it simple and modular. No new dependency or layer unless a screen needs it.
- Brief facts only. Anything else is a labelled assumption in `CLAUDE.md` and `docs/TDD.md`.
- Never commit `.env`, secrets or real personal data.

## Current state

| Prompt | Status |
|---|---|
| 0. Setup | Done |
| 1. Sample data | Done |
| 2. Sign-in and consent | Done |
| 3. Parent home and payment | Done |
| 4. Fee ledger | Done |
| 5. Reminders | Done |
| 6. Refund calculator | Done |
| 7. Dues dashboard | **Next** |
| 8. Dropout-risk flag | To do |
| 9. Polish check | To do |
| 10. Submission files | To do |

Last verified: 150 tests pass (93 unit, 57 database), lint, types and build are clean, and CI passes on `main`. The working tree is clean.

## Run it

```
npm run dev
```

Open http://localhost:3000. The server does not survive the session that started it, so start it again if the site is down.

- **Postgres:** the Windows service runs on port **5433**, not 5432. Database is `fee_tracker`.
- **`.env`:** already exists locally with all 7 variables. It is gitignored. Do not print it or copy its values anywhere.
- **Demo date:** `APP_TODAY=2026-11-02`. The brief's sample data only works on this date.
- **Reset data:** `npm run db:seed`. This also clears consent and test payments.

| Number | Who |
|---|---|
| `9000000002` | Parent of Ishita Sharma, part paid, 23 days overdue |
| `9000000003` | Parent of Mohit Gurjar, due in 13 days |
| `9000000001` | Parent of Aarav Meena, up to date |
| `9000001035` | Parent of two children |
| `9000000100` | Accounts staff |

The OTP appears on screen in demo mode.

## Next step: prompt 7

Build the dues dashboard, using the text in `prompt.md`. Things to know from prompt 6:

- A student with `exit_date` set has a closed fee account, so their unpaid instalments are not collectable. Leave them out of dues totals and ageing, and label the assumption in `CLAUDE.md` and `docs/TDD.md`.
- `refundOf` in `src/lib/refunds.ts` reads a saved refund. The seed has none, so save one in the app to test this.

## Decisions waiting on the owner

1. **Long-overdue reminders.** They end 7 days after the due date. The owner has not yet answered whether to repeat them weekly until paid.
2. **Repo visibility.** It is private. The brief requires it to be public by submission. It is the owner's call when.
3. **`CLAUDE.md`, `prompt.md` and this file** are committed, and their names will be visible once public. The owner has not yet said whether to keep them tracked.

## How each prompt is done

1. Build with logic in `src/domain`, tests beside it, and thin pages in `src/app`.
2. Run `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`, `npm run build`.
3. Check in a real browser: desktop and 360px, Hindi and English, wrong-role access, the console.
4. Update `prompt.md`, `docs/TDD.md`, `deployment.md` and the assumptions in `CLAUDE.md`.
5. Commit in logical steps, push, and confirm CI passes.
6. Run `npm run db:seed` so the owner sees fresh data, and leave the server running.

## Code map

| Path | Job |
|---|---|
| `src/domain/` | Pure rules: money, dates, instalments, refund, payments, reminders, gst, otp, access |
| `src/lib/payments.ts` | `recordPayment`, the only code that marks an instalment paid |
| `src/lib/reminders.ts` | The reminder job and list query |
| `src/lib/auth.ts` | `requireUser`, `requireParent`. Call first in every protected page and action |
| `src/lib/refunds.ts` | `saveRefund`, which also stops reminders and closes the fee account, and `refundOf` |
| `src/lib/ledger.ts` | Instalment, payment and receipt queries |
| `src/lib/staff-students.ts` | Student search and lookup |
| `src/lib/clock.ts` | `today()`. Never use `new Date()` for business dates |
| `src/db/sample-data.ts` | Pure, seeded sample data with tests |
| `src/i18n/` | All user text. `hi.ts` must match the shape of `en.ts` |
| `src/components/` | `DataTable`, `ActionForm`, `SubmitButton`, `StatusChip`, `TextField`, `ReceiptView` |

Money is whole paise. Dates are `YYYY-MM-DD` strings.

## Sample data for later prompts

- **Risk flag, should trigger:** STU-1037 Neha Joshi, STU-1038 Chirag Joshi, STU-1039 Uday Meena.
- **Risk flag, too little data:** STU-1040 Manav Shekhawat. It must create no task.
- **Risk flag, should not trigger:** STU-0587 Ishita Sharma, who has a late fee but steady attendance and scores.
- **Reminder stages on the demo date:** STU-1041 to STU-1045. STU-1046 paid early, so its reminders show as stopped.
- **Unmatched payment:** `GW-TEST-UNMATCHED-0001`, ₹12,500.

## Environment pitfalls

- **Multi-line shell commands** containing apostrophes or backticks can fail with `unexpected EOF`, and nothing runs. Write the content to a script file first, then run the file.
- **Temporary Postgres** started with `pg_ctl` hangs with shared memory error 487. Use `npm run test:db`, which uses the real service and a separate `fee_tracker_test` database.
- **Headless browser** cannot read `D:` paths. Serve through localhost, or copy files to `C:` first.
- **Screenshots** can catch fallback fonts before web fonts load. Wait for `document.fonts.ready`.
- **Browser form limits** such as `max` can hide server rules. Remove them when testing the server, and do not trust a leftover alert.
- **`AGENTS.md`** is generated by `next dev` and is gitignored.
- **Docs edits:** check that Mermaid diagrams still render after changing `docs/TDD.md`.

## Before submission

- Finish prompts 6 to 10, then remove every *Planned* label that no longer applies in `docs/TDD.md`.
- Deploy, and put the live link at the top of the TDD.
- Schedule the daily call to `/api/cron/reminders`.
- Add the demo logins for the live site to `deployment.md`.
- Export the TDD to PDF. The zip holds the TDD and `deployment.md`, up to 25 MB.
- Make the repo public.

## Known gaps

Not blocking, and listed in `docs/TDD.md` where they affect the client:

- A saved manual payment cannot be reversed. If time allows, add a reversal entry, never a delete.
- A saved refund cannot be reversed either, and there is no "refund paid" step or list of refunds across students.
- Unmatched payments have no staff screen yet (optional depth).
- The phone field clears after a validation error. Fix in prompt 9.
- Hindi text needs review by a native speaker.
