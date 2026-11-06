# Fee Tracker

Fee portal for Company A, a Jaipur coaching institute (4 centres, 2,600 students). The full brief is `docs/brief.txt`, and it wins over everything else here. Build the core slice really well, not the whole scope badly.

## Ground rules

- **No AI attribution anywhere.** No `Co-Authored-By` trailers, no "Generated with" lines, in commits, PRs, code or docs.
- **Push as the repo owner.** Commits use the configured git identity, Siddhesh-source.
- **Conventional commits.** `type(scope): summary`, for example `feat(refund): add pro-rata calculator`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`. One logical change per commit, because reviewers read the history.
- **Keep it simple.** No new dependency, layer or abstraction unless a screen needs it today.
- **Brief facts only.** Anything not in the brief is an assumption and goes in the table below.
- **No secrets or real personal data** in the repo. Sample people are fictional. Phone numbers are fake.

## Core build

Roles: parent and accounts executive. About 6 to 8 screens, all working end to end:

1. **Fee ledger** per student: plan, instalments, discounts, payments, balance, days overdue.
2. **Parent portal** with OTP login: dues and a pay link per instalment (mock gateway) that marks it paid.
3. **Reminders** in Hindi or English, before, on and after each due date, stopping on payment.
4. **Pro-rata refund calculator** following the written policy.
5. **Dues dashboard** by centre and batch, with ageing and Tally export.
6. **Dropout-risk flag.**

Mock payments, messages and outside systems. Optional depth, built after the core worked: attendance and scores for parents, bulk upload. Level-up, built on top: event pipeline, reviewer console, director scoreboard, refund desk, risk lab, close the books. Still optional: a separate receipts list.

Out of scope: video lectures or a learning platform, timetables, admissions CRM.

## Hard rules from the brief

- **Risk flag:** built from missed instalments, falling attendance and test trends. It only creates a counsellor call task. It never triggers a fee action or a parent message. Counsellors can mark false flags. With too little data, it says so and creates no task.
- **Payment matching:** a payment that cannot be matched goes to an accounts queue. It never marks anything paid.
- **Reminders:** stop the moment an instalment is fully paid. Check this at send time, not only at scheduling time.
- **Refunds:** pro-rata, due within 10 days of the student leaving, with a published policy page.
- **Consent:** verifiable parental consent before showing a minor's data (DPDP Act 2023).
- **Receipts:** must show GST.
- **Hindi:** required on all parent screens and reminders.
- **Must have on every screen:** works on a phone, plus loading, empty and error states. No dead buttons.
- **Security:** validate all inputs on the server, and check role and ownership on every read and write.

## Assumptions

Label each of these in the Technical Design Document. Add new ones here as they come up.

| Topic | Assumption | Why |
|---|---|---|
| Refund formula | Refund = paid − (net fee × days used ÷ term days). Days count both end dates. The fee used is rounded to the whole rupee. Never below ₹0 | The brief requires pro-rata but gives no written policy |
| Retained fee | None | The brief mentions no registration fee |
| Academic term | 1 Jul 2026 to 30 Jun 2027, 365 days | The brief gives no dates. Instalments run to April |
| Instalment plans | ₹1,20,000 as 4 × ₹30,000 or 3 × ₹40,000 | Fits the brief's average fee and its sample rows |
| Batch schedules | Due dates are set per programme, and JEE 2028 and NEET 2028 batches exist | The brief gives only three sample due dates |
| Sample data | 60 fictional students, replayed day by day as events. Beyond the 3 brief rows, all fee records, attendance and scores are invented | The brief asks for realistic sample data you create |
| Demo date | `APP_TODAY=2026-11-02` | The sample's "23 days overdue" and "Due in 13 days" both point to this date |
| Reminder schedule | 7 and 1 days before, on the day, 3 days after, weekly from day 7 to day 63, then every 4 weeks up to a year, until paid | The brief says before, on and after, and to stop on payment, not after a set time. Its 60 day measure needs follow-up past 60 days, and thinning out keeps parents from feeling chased |
| Reminder delivery | Sent to the registered number whether or not the parent has used the portal, and includes the student's name so a parent of two knows which child | Fee reminders are the service itself, and the brief wants them automatic |
| Missed job days | Only the latest due stage goes out | A parent should never get several messages at once |
| Individual due dates | 6 sample students have their own due dates, so every stage falls on the demo date | Otherwise nothing would be due on the fixed demo date |
| Ageing buckets | 0–30, 31–60, 60+ days | The brief's success measure uses 60 days |
| Centre names | Centre 1 to Centre 4 | The brief does not name them |
| Counsellor | The accounts role handles call tasks | The brief lists only two roles |
| Risk method | Transparent points, not a trained model. Attendance compares the last 4 weeks with earlier weeks, tests the last 2 with earlier tests. A fall of 15 or 30 points in attendance, or 10 or 20 in tests, scores 1 or 2. Missed instalments score 1 or 2. 2 points is watch, 4 is high | There is no real dropout history to train on, and a counsellor must see why |
| Late fees alone | Never flag a student, however many are missed | Reminders handle money, and being short of money is not a sign of leaving. Ishita's sample row shows this |
| Too little data | Under 6 weeks of attendance, under 4 tests, or no fee plan | The brief says to say so, not how much is enough |
| Records that stop | Two weeks behind the latest attendance in the batch scores 2 points, as the strongest attendance sign | A student who vanishes is the likeliest dropout, and a late file for a whole class must not flag everyone |
| Refund approval | A second accounts user approves, enforced by a database check. No new role | The brief names two roles, and money going out needs two people |
| Credit notes | Paying a refund issues a numbered credit note with GST split, and it goes to the Tally export. An accountant must confirm the treatment | The brief says receipts show GST, not how refunds treat it |
| Reversals | A wrong payment is marked reversed, never deleted. The receipt shows as cancelled, a Reversal voucher goes to Tally on the reversal day, and future reminders restart. Refused once a student has left | Money must be corrected with a new entry, and a saved refund used that money |
| Month close | A person closes a month once it has ended and the ledger and Tally file agree, nothing is queued and receipts have no gaps. A closed month refuses backdated payments | The brief measures month-end time, not how to close |
| Late share | Per rupee, only instalments due 60 or more days ago. Money still unpaid after 60 days counts as late | The brief gives the measure without defining it |
| Parent call measure | Shown as not tracked | The app has no call data, and metrics are never invented |
| Time machine | Demo mode only, forward only, in memory, shared by everyone on the demo, and restored from pipeline runs after a restart | A system that acts over weeks cannot otherwise be reviewed in minutes |
| Repeat flags | One open task per student. After a review, no new task for 30 days | A counsellor should not be asked again the next morning |
| Unmatched queue | Staff apply queued money from plain-rule suggestions, or return it to the payer with a note. Money naming a student is offered only to that student, and an exact balance counts only if one student has it | The brief requires the queue. A common amount is not evidence |
| False flag note | Required, so the reason is on record | The brief says counsellors mark false flags, and the reason helps tune the rule |
| OTP delivery | SMS is mocked. With `DEMO_MODE=true` the code shows on screen | The brief says to mock messages |
| OTP limits | 5 minutes, 5 tries per code, 5 codes per number in 10 minutes | The brief asks for OTP login, not its limits |
| Consent proof | OTP sign-in on the registered number, plus a stored, versioned record per child | The brief requires verifiable consent, not the method |
| GST | 18%, included in the fee, split into 9% CGST and 9% SGST, with a sample GSTIN | The brief says receipts show GST, not the rate or number |
| Payment matching | A payment up to the balance is applied, as a part payment if smaller. More than the balance goes to the queue | The brief says a wrong amount marks nothing paid, and its sample data has part payments |
| Manual payments | Must fit the balance, or they are refused and nothing is saved. Dates cannot be in the future | A staff typing mistake is not money that arrived, so it should not enter the queue |
| Parent home amount | Shows the oldest unpaid instalment, and mentions any other overdue amount | The pay link is per instalment, so the button must match the amount shown |
| Pay links | Signed, valid for 7 days, and show no student data | Reminders will carry them, so they must be safe outside a signed-in session |
| Refund saving | A future exit date can be previewed but not saved. Saving is final, one per student, and keeps the figures used. It then moves from calculated to approved to paid, and a ₹0 refund skips those steps | Saving stops reminders, so it must mean the student has really left |
| After a refund is saved | The fee account closes. Parents see the refund instead of dues, pay links stop, gateway money goes to the queue, and manual payments are refused | A later payment would make the saved refund wrong |
| Unpaid fee used | Shown to staff when paid is less than fee used, never collected automatically | The brief only covers refunds, not recovering money from leavers |
| Refund deadline | Counts from the exit date, even if the refund is saved late, and shows as overdue if passed | The brief says within 10 days of the student leaving |
| Dues figures | Billed is every instalment for the term. Outstanding is all unpaid, overdue is the part past its due date. Students who have left are not counted | The brief asks for dues and ageing without defining them, and a closed account is not collectable |
| Tally export | One CSV row per matched receipt, with fee, CGST and SGST split, and student ID but no name. Includes students who have left | The brief names no format. Centres post receipts to Tally, and the money was really received |
| Upload format | CSV only, one batch and one kind per file, columns found by name, up to 200 KB and 2,000 rows. A template lists the batch's current students, with names | The brief names no format. Excel saves CSV, so no new dependency is needed |
| Upload checks | All or nothing, with a preview before saving. Whole numbers, up to 50 classes a week and 1,000 marks. Week start must be a Monday. Dates cannot be in the future, before term or after the student left. Dates can be year first or day first | One bad row usually means a bad file. A wrong week or year would skew the risk flag without anyone noticing |
| Negative marks | Refused. A test score must be 0 or more | The database keeps scores in range, and the brief does not mention negative marking |
| Upload corrections | A row for a saved week or test replaces it, and the preview shows old and new. An identical row changes nothing. No history of replaced values is kept | Staff need to fix mistakes, and a repeat upload should be harmless |
| Blank upload rows | A row with a student ID and no values is skipped and counted | A student absent from a test has nothing to record |
| Upload and risk | Saving does not run the risk check. The daily job or the staff button does | One upload should not create call tasks before staff have finished entering data |
| Parent progress page | Linked from the instalments page, never from parent home. Shows the latest 12 weeks and 12 tests as plain figures, with no trend or risk wording | The brief's home page is amount, due date and pay button, nothing more. Risk is for staff only |

## Stack

Next.js (App Router, TypeScript), Postgres, Drizzle, Tailwind, Vitest. One app, one deploy.

```
src/
  app/       routes only: thin pages and server actions
  components/  small shared UI pieces
  domain/    pure business rules, no framework or database imports
  db/        schema, client, sample data, events and replay
  i18n/      English and Hindi text
  lib/       env, clock, sessions and anything that needs cookies or the database
docs/        brief, mockups and technical design
```

- Money is integer paise. Format it only with `formatInr`.
- `lib/payments` is the only code that marks an instalment paid or changes a payment, for gateway, manual and queue payments alike.
- Dates are `YYYY-MM-DD` strings. Get today from `lib/clock`, never `new Date()`, so the demo date holds. Security timers such as OTP expiry use the real clock.
- Call `requireUser` or `requireParent` from `lib/auth` first in every protected page and server action.
- User-facing text comes from `src/i18n`, never hardcoded.
- Every rule in `src/domain` has a test next to it, using the brief's sample data.
- Anything from outside enters as a `PipelineEvent` and goes to its real entry point. `runDay` in `lib/pipeline` is the only daily pipeline.
- Changes to money and records call `audit` in the same transaction. Receipts and exports use `istDate`, never UTC.

## Commands

```
npm run dev          start the app
npm test             run unit tests
npm run test:db      run database tests on a separate test database
npm run typecheck    check types
npm run lint         lint
npm run build        production build
npm run db:migrate   apply migrations
npm run db:seed      load sample data
```

Before each commit: `npm test`, `npm run test:db`, `npm run typecheck` and `npm run lint` must pass.

## How to work

Follow `prompt.md` in order, one prompt at a time. Update `prompt.md` when a step is finished or changes. Update `docs/TDD.md` and `deployment.md` in the same step, so their status and limits stay true. Record choices in `docs/decisions.md` and anything that went wrong in `docs/mistakes.md`.

## Design System

Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.
