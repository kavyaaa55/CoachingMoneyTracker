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

Mock payments, messages and outside systems. Optional depth only after the core works: receipts list, attendance and scores for parents, bulk upload, unmatched queue screen.

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
| Sample data | 43 fictional students. Beyond the 3 brief rows, all fee records, attendance and scores are invented | The brief asks for realistic sample data you create |
| Demo date | `APP_TODAY=2026-11-02` | The sample's "23 days overdue" and "Due in 13 days" both point to this date |
| Reminder schedule | 7 and 1 days before, on the day, 3 and 7 days after | The brief says before, on and after, without days |
| Ageing buckets | 0–30, 31–60, 60+ days | The brief's success measure uses 60 days |
| Centre names | Centre 1 to Centre 4 | The brief does not name them |
| Counsellor | The accounts role handles call tasks | The brief lists only two roles |
| OTP delivery | SMS is mocked. With `DEMO_MODE=true` the code shows on screen | The brief says to mock messages |
| OTP limits | 5 minutes, 5 tries per code, 5 codes per number in 10 minutes | The brief asks for OTP login, not its limits |
| Consent proof | OTP sign-in on the registered number, plus a stored, versioned record per child | The brief requires verifiable consent, not the method |
| GST | 18%, included in the fee, split into 9% CGST and 9% SGST, with a sample GSTIN | The brief says receipts show GST, not the rate or number |
| Payment matching | A payment up to the balance is applied, as a part payment if smaller. More than the balance goes to the queue | The brief says a wrong amount marks nothing paid, and its sample data has part payments |
| Parent home amount | Shows the oldest unpaid instalment, and mentions any other overdue amount | The pay link is per instalment, so the button must match the amount shown |
| Pay links | Signed, valid for 7 days, and show no student data | Reminders will carry them, so they must be safe outside a signed-in session |

## Stack

Next.js (App Router, TypeScript), Postgres, Drizzle, Tailwind, Vitest. One app, one deploy.

```
src/
  app/       routes only: thin pages and server actions
  components/  small shared UI pieces
  domain/    pure business rules, no framework or database imports
  db/        schema, client, seed
  i18n/      English and Hindi text
  lib/       env, clock, sessions and anything that needs cookies or the database
docs/        brief and mockups
```

- Money is integer paise. Format it only with `formatInr`.
- `recordPayment` in `lib/payments` is the only code that marks an instalment paid.
- Dates are `YYYY-MM-DD` strings. Get today from `lib/clock`, never `new Date()`, so the demo date holds. Security timers such as OTP expiry use the real clock.
- Call `requireUser` or `requireParent` from `lib/auth` first in every protected page and server action.
- User-facing text comes from `src/i18n`, never hardcoded.
- Every rule in `src/domain` has a test next to it, using the brief's sample data.

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

Follow `prompt.md` in order, one prompt at a time. Update `prompt.md` when a step is finished or changes.

## Design System

Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.
