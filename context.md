# Project Handover

Read this first, then continue from **Next step**.

**Last updated:** 6 Nov 2026, version 1.0.0 plus the level-up in the changelog.

## What this is

Fee Tracker: a 7-day solo assessment build for Company A, a Jaipur coaching institute. Parents see dues and pay on a phone, in Hindi or English. Accounts staff get ledgers, reminders and refunds. Submission is a zip holding a TDD (PDF or Word) and `deployment.md`.

## Read in this order

1. `CLAUDE.md`: ground rules, hard rules from the brief, assumptions, stack
2. `prompt.md`: build order and status
3. `DESIGN.md`: read before any UI work
4. `docs/brief.txt`: the client brief, which wins over everything else
5. `docs/TDD.md`: architecture, decisions, limits
6. `docs/decisions.md`, `docs/mistakes.md` and `docs/security.md`: why things are as they are, what went wrong, and what was attacked
7. `public/guide/index.html`: the visual guide, served at `/guide/index.html`

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
| 7. Dues dashboard | Done |
| 8. Dropout-risk flag | Done |
| 9. Polish check | Done |
| 10. Submission files | Done |
| 11. Optional depth: parent attendance and scores, bulk upload | Done |
| 12. Level-up: event pipeline and five differentiators | Done |

Last verified: 426 tests pass (243 unit, 183 database), 65 live attack checks pass, lint, types and the production build are clean, and the AI layer was exercised with live Gemini calls.

## Run it

```
npm run dev
```

Open http://localhost:3000. The server does not survive the session that started it, so start it again if the site is down.

- **Postgres:** the Windows service runs on port **5433**, not 5432. Database is `fee_tracker`.
- **`.env`:** already exists locally with all 7 variables. It is gitignored. Do not print it or copy its values anywhere.
- **Demo date:** `APP_TODAY=2026-11-02`. The brief's sample data only works on this date.
- **Reset data:** `npm run db:seed`, or **Reset demo** on the Reviewer console. This replays the term in about 15 seconds and clears consent and test payments.
- **Move the date:** the Reviewer console at `/staff/demo`. Each day runs the real pipeline.

| Number | Who |
|---|---|
| `9000000002` | Parent of Ishita Sharma, part paid, 23 days overdue |
| `9000000003` | Parent of Mohit Gurjar, due in 13 days |
| `9000000001` | Parent of Aarav Meena, up to date |
| `9000001035` | Parent of two children |
| `9000000100` | Accounts Executive, who saves refunds |
| `9000000101` | Accounts Manager, who approves them |

The OTP appears on screen in demo mode.

## Next step: owner actions

Version 1.0.0 is tagged and released, and prompts 11 and 12 are on top of it, unreleased. What is left is the owner's:

1. **Deploy** using the AWS guide in `deployment.md`, then put the live link at the top of `docs/TDD.md`.
2. **Export the TDD** to PDF. Check that the Mermaid diagrams survive.
3. **Make the repo public.** The brief requires it until review ends. Then check the CI badge in the README.
4. **Zip** the TDD and `deployment.md`, up to 25 MB.

`docs/BRIEF-CHECK.md` lists every requirement and its status.

## Decisions made

- **Refund rule:** pure pro-rata with no retained fee, confirmed by the owner.
- **Long-overdue reminders:** they continue until paid, weekly to day 63, then every 4 weeks up to a year. Decided from the brief, see `docs/TDD.md`.
- **`CLAUDE.md`, `prompt.md` and this file** stay tracked. The owner decided. The brief recommends AI tools and reads the commit history, so they are honest working records.

- **Data pipeline:** sample data is replayed as events through the real entry points. Only enrolment is inserted directly. See `docs/decisions.md`.
- **AI layer:** Gemini gives the risk flag, with rules as fallback and the hard lines in code. It also drafts call guides and reads payer notes, and batch baselines and thresholds learn from data. All of it sits inside the existing screens. `GEMINI_API_KEY` is optional and lives in `.env`.
- **Level-up:** the five items in `level-up.md` are built. No new dependency or role, and parent home is unchanged apart from a refund status line.

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
| `src/domain/` | Pure rules: money, dates, instalments, refund, payments, reminders, dues, tally, risk, gst, otp, access |
| `src/lib/payments.ts` | `recordPayment`, `applyQueuedPayment`, `reversePayment`, `returnQueuedPayment`. The only code that changes a payment |
| `src/lib/pipeline.ts` | `runDay` and `replayDays`: events to real entry points, then the daily jobs |
| `src/db/sample-events.ts`, `src/db/load-sample.ts` | Sample data as events, and the replay |
| `src/lib/simulator.ts`, `src/lib/demo.ts` | Demo only: future events and the time machine |
| `src/lib/books.ts` | Month-end checks, closing a month, queue suggestions |
| `src/lib/audit.ts` | The append-only audit log |
| `src/domain/ai.ts`, `src/lib/ai.ts` | The AI layer: what is sent, what is accepted, and the Gemini call with its fallbacks |
| `src/lib/scoreboard.ts`, `src/lib/risk-lab.ts` | Read-only queries for those pages |
| `src/lib/reminders.ts` | The reminder job and list query |
| `src/lib/auth.ts` | `requireUser`, `requireParent`. Call first in every protected page and action |
| `src/lib/refunds.ts` | `saveRefund`, which stops reminders and closes the fee account, then `approveRefund` and `markRefundPaid` |
| `src/lib/dues.ts` | Dues and Tally export queries, with centre and batch filters |
| `src/lib/risk.ts` | The risk job, task list and review. It writes only to `risk_flags` |
| `src/lib/ledger.ts` | Instalment, payment and receipt queries |
| `src/lib/staff-students.ts` | Student search and lookup |
| `src/lib/clock.ts` | `today()`. Never use `new Date()` for business dates |
| `src/db/sample-data.ts` | Pure, seeded sample data with tests. All the facts, none of the rows |
| `src/i18n/` | All user text. `hi.ts` must match the shape of `en.ts` |
| `src/components/` | `DataTable`, `ActionForm`, `SubmitButton`, `StatusChip`, `TextField`, `ReceiptView` |

Money is whole paise. Dates are `YYYY-MM-DD` strings.

## Sample data for later prompts

- **Risk flag, triggers:** STU-1037 Neha Joshi, STU-1038 Chirag Joshi, STU-1039 Uday Meena, high. STU-1033 Uday Vyas and STU-1056 Pranav Saini, watch. The replay runs the rule daily, then Gemini judges the demo date, so with a key it may add or change tasks. Manav Bairwa, STU-1021, was an AI-only flag.
- **Records that stop:** STU-1056 Pranav Saini.
- **Paid over 60 days late:** STU-1047 to STU-1049. The STU-1048 entry is reversed on 20 Oct.
- **Left:** STU-1050 to STU-1055: inside the deadline, overdue, approved, paid on time, paid late, and ₹0.
- **Exact queue match:** Vidhi Soni, STU-1057, for the ₹12,500.
- **Payer note to read with AI:** `GW-TEST-UNMATCHED-0004`, ₹10,000, which points to Mohit's second instalment.
- **Risk flag, too little data:** STU-1040 Manav Shekhawat. It creates no task.
- **Risk flag, does not trigger:** STU-0587 Ishita Sharma, who has a late fee but steady attendance and scores.
- **Reminder stages on the demo date:** STU-1041 to STU-1045. STU-1046 paid early, so its reminders show as stopped.
- **Unmatched payments:** `GW-TEST-UNMATCHED-0001` ₹12,500 with no reference, `-0002` for a student who left, `-0003` an overpayment.

## Environment pitfalls

- **Multi-line shell commands** containing apostrophes or backticks can fail with `unexpected EOF`, and nothing runs. Write the content to a script file first, then run the file.
- **Temporary Postgres** started with `pg_ctl` hangs with shared memory error 487. Use `npm run test:db`, which uses the real service and a separate `fee_tracker_test` database.
- **Headless browser** cannot read `D:` paths. Serve through localhost, or copy files to `C:` first.
- **Screenshots** can catch fallback fonts before web fonts load. Wait for `document.fonts.ready`.
- **Browser form limits** such as `max` can hide server rules. Remove them when testing the server, and do not trust a leftover alert.
- **Signed-out pages** return HTTP 200 with a streamed redirect, because of `loading.tsx`. Check the body, not the status code. Route handlers return a real 307.
- **The consent screen** has "Not now" instead of "Sign out", so scripts that sign out must handle it.
- **Windows line endings:** working files are CRLF, so a patch script must normalise them. `next start -p` is rejected by the shell wrapper: use `node node_modules/next/dist/bin/next start --port 3000`.
- **Backslashes in shell heredocs** can be lost, so a regex `\\b` became a backspace. Use the editor.
- **Streamed pages:** wait a moment before reading a page in a script, or the snapshot shows only the shell.
- **Chain commits with `&&`**, never `;`, so a failing test stops the commit.
- **`AGENTS.md`** is generated by `next dev` and is gitignored.
- **Docs edits:** check that Mermaid diagrams still render after changing `docs/TDD.md`.

## Before submission

- Deploy, and put the live link at the top of the TDD.
- Schedule the daily call to `/api/cron/daily`.
- Add the demo logins for the live site to `deployment.md`.
- Export the TDD to PDF. The zip holds the TDD and `deployment.md`, up to 25 MB.
- Make the repo public.

## Known gaps

Not blocking, and listed in `docs/TDD.md` where they affect the client:

- A saved refund cannot be reversed.
- Only a queued payment that fits one instalment can be applied. Anything else is returned to the payer.
- The Tally columns are assumed and need a trial import.
- Hindi text needs review by a native speaker.
