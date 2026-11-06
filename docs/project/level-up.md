# Level Up

Five additions that would make this submission stand out, without changing what the product is.

**Status: all five are built, on top of a new event pipeline.** This file is the original plan. What was decided along the way is in [docs/decisions.md](../decisions.md), and what went wrong is in [docs/mistakes.md](../mistakes.md).

## The short version

The build is not bare minimum. It has 263 tests, signed webhooks, row locks and honest limits. More features won't separate it from other submissions, but these three things will:

1. **A reviewer can't see it working.** This product acts over days and weeks, and a reviewer gets about ten minutes on a frozen date.
2. **It doesn't report the client's goal.** The brief gives three success measures, and no screen tracks them.
3. **Its own limits list names the gaps.** `docs/BRIEF-CHECK.md` marks the unmatched queue and the refund deadline as Partial, and the TDD says the risk rules are untested.

The five ideas below fix exactly these. None needs a new dependency, a new role or a change to parent home.

**Do this first:** deploy. There is still no live link, and the brief's first line under "What great looks like" is "A product a client could try today". Without a link, most of this goes unseen.

| # | Addition | What it proves | Brief line it answers | Size |
|---|---|---|---|---|
| 1 | Reviewer Console with a time machine | The automation really runs | "The AI or automation part actually works" | M |
| 2 | Director Scoreboard | You built for the outcome, not the feature list | "Success: value over 60 days late from 12% to 6%" | S to M |
| 3 | Refund Desk | Legal deadlines are enforced, with proper money controls | "A pro-rata refund within 10 days" | M |
| 4 | Risk Lab | The flag can be tested and challenged | "The AI part faked, or not handling mistakes" | M |
| 5 | Close the Books | The ledger can be trusted at month end | "Month-end reconciliation from 4 days to 1" | L |

Sizes are relative. Build in this order, and stop wherever time runs out. Each one is complete by itself.

---

## 1. Reviewer Console with a time machine

**Why it stands out.** Reminders, ageing, refund deadlines and risk flags all depend on time passing. Today a reviewer has to take that on trust. With this, they watch a whole term play out in three minutes. Most submissions will be static screens on a fixed date.

**What to build.** A `/staff/demo` page, available only when `DEMO_MODE=true`:

- **Move time:** buttons for +1 day, +7 days and "next due date". Each day passed runs `runReminders(date)` and `runRiskCheck(date)`, which already accept a date.
- **Phone preview:** the reminders just sent, in Hindi or English, inside a simple phone frame. The text is already stored in `reminders.message`.
- **Guided story:** "Ishita is overdue, a reminder goes out. Pay it here. Move 7 days. Her reminders have stopped." The pay step opens her signed link, so no second sign-in is needed.
- **What changed:** a short feed, such as "3 sent, 2 stopped on payment, 1 new call task".
- **Reset demo:** puts the data and the date back to the start, so the next reviewer gets a clean copy.

**Traps found in the code**

- `today()` is synchronous and is used across 13 files, so keep it that way. Add a `globalThis` override in `src/lib/clock.ts` and leave every caller alone. This works on one server process, which matches the AWS guide. The override is shared by everyone on the demo, so state that in the limits.
- Time only moves forward. Going back would leave reminders sent "in the future", so Reset is the only way back.
- `src/db/seed.ts` runs as soon as it is imported and then closes the database client. Export a `seedDatabase()` function that the script and the button both call.
- Reset recreates every user with a new ID, so everyone is signed out. Say so on the button, and send the user to sign-in.
- Reset wipes the database, so it needs both `DEMO_MODE` and a staff sign-in, plus the confirm step `DESIGN.md` requires. Add a test that the page and the action return 404 with demo mode off.

**Also:** put "Try it in 3 minutes" at the top of the TDD and `deployment.md`, with the link and the steps.

**In the interview:** "The clock was already in one file from day one, so a time machine was a small change. It's the only way to show a reminder stopping."

---

## 2. Director Scoreboard

**Why it stands out.** The founder-director signs the deal, and the brief states exactly what they are paying for. Almost everyone builds the features. Few build the screen that shows whether the features worked. The TDD already lists this as a gap.

**What to build.** A `/staff/scoreboard` page, using the accounts role. Figures and tables only, because `DESIGN.md` removed progress bars.

| Brief measure | Baseline, target | What the screen shows |
|---|---|---|
| Value over 60 days late | 12% to 6% | The real figure, plus a table by due month and by centre |
| Month-end reconciliation | 4 days to 1 | Share of receipts matched automatically, open queue items, age of the oldest |
| Parent calls about dues | Down 70% | An honest "Not tracked yet: needs Company A's call count". The app has no call data, and `DESIGN.md` bans invented metrics |

Add two supporting figures: paid within 3 days of a reminder, and refunds paid within 10 days (from idea 3). Word the first as "paid within 3 days", never "paid because of", since timing doesn't prove cause.

**Traps found in the code**

- **The definition decides the answer.** Count only instalments due at least 60 days ago. Counting newer ones would dilute the figure and flatter it. Work per rupee, so a part payment counts correctly. Decide whether unpaid money past 60 days counts as late. I suggest yes, and label it an assumption.
- **The seed can't show this yet.** Payments land at most 9 days after the due date (`sample-data.ts`, `random.int(-6, 9)`), so nothing has ever been paid over 60 days late. See "Seed changes" below.
- Label the page as sample data, and show percentages. Don't project rupee savings from 49 invented students.

**In the interview:** "I put the client's three measures on one screen. One of them can't be measured from the app, so the screen says that rather than making up a number."

---

## 3. Refund Desk

**Why it stands out.** Refunds are the brief's named hard part and its legal constraint. The app calculates the refund well, then stops. It doesn't show which refunds are near the 10-day limit, and nothing can be marked paid. Adding a second-person approval and a GST credit note shows real knowledge of how finance teams work.

**What to build**

- **`/staff/refunds`:** every refund across students, soonest deadline first, with chips such as "3 days left" and "2 days overdue".
- **Three steps:** Calculated, Approved, Paid. The enum `refund_status` already has these values, but no code ever sets them. Every refund stays "calculated" forever.
- **Two people:** the person who saved a refund can't approve it. Enforce this with a database check, `approved_by <> created_by`, as well as in the action.
- **Paid step:** record date, method and reference. A ₹0 refund closes without a payment step.
- **Credit note:** a printable note with its own number series, splitting the refund with the existing `splitGst`. It also goes into the Tally export, which closes the "refunds are not exported" limit.
- **Parent view:** the existing refund screen gains a status line in Hindi and English.

**Traps found in the code**

- The seed has one staff user and no refunds, so this page would open empty and approval would be impossible. See "Seed changes".
- "Saving is final" stays true. This adds steps after saving and doesn't reopen the amount.
- Credit notes aren't in the brief, so label them as an assumption. Have a chartered accountant confirm the treatment before real use, and say so in the TDD.

**In the interview:** "The deadline was on one student's page, where nobody would see it slipping. A legal deadline needs a list, and paying out money needs a second person."

---

## 4. Risk Lab

**Why it stands out.** "The AI part faked" is on the brief's list of common mistakes, and the TDD says plainly that the flag is rule-based with thresholds set by judgement. That honesty is good, but it leaves an open question: how would anyone know it works? This answers it. A checkable rule beats a black box here, and it's the serious answer to "where's the AI?".

**What to build**

- **Replay:** run `assessRisk` for every past Monday of the term, using only what was known that day. Report who was flagged, how many weeks before they left, who was missed, and false flags.
- **What-if:** a page at `/staff/tasks/lab` where staff change the thresholds and see who would be added or dropped. It is a plain GET form that writes nothing. Live rules change only through a reviewed code change.
- **Silent student fix:** the TDD admits that a student whose records simply stop "looks steady". That is probably the likeliest dropout, and today it can't be flagged. Add a `missing` reason: no attendance for 2 weeks or more, while the rest of the batch has records. The batch check stops a late upload from flagging a whole class.
- **Rule version:** store `rule_version` on each flag, so a false-flag rate always refers to a known rule. Show the false-flag rate per reason as well.

**Traps found in the code**

- **Look-ahead.** The domain `Instalment` type holds only total `paid`, so a simple replay would use payments that hadn't happened yet. Rebuild `paid` from payment dates for each replay day, and filter attendance and scores the same way. Add a test for this, because it's the classic backtest mistake.
- `assessRisk` uses constants at the top of the file. Pass them in as a `rules` argument defaulting to today's values, so the live job can't change.
- The "late fees alone never flag" guard must not be adjustable in the lab. Add a test.
- Extend the existing test that snapshots all the other tables, so it covers the lab as well.
- A new `RiskReason` kind needs wording in both `en.ts` and `hi.ts`.
- No sample student has left, so the replay has no outcomes to measure. See "Seed changes".

**Say this clearly on the page.** On invented data, the replay proves the tool works, not that the rule predicts dropouts. Its real value starts with Company A's history.

**In the interview:** "A trained model on data I invented would give a fake accuracy number. So I built the thing that would catch a bad rule, and it ran on day one."

---

## 5. Close the Books

**Why it stands out.** This is what a fintech reviewer looks for: money that can be corrected without being erased. The queue is read only, a payment typed wrongly can't be undone, and the audit log was cut. `DESIGN.md` already lists mockups 8.2 and 8.3 for this work. It's the largest item, so it comes last.

**What to build**

- **Apply from the queue:** each unmatched payment shows ranked suggestions with a plain reason, such as "Same amount as Ishita's balance". A person always confirms. Nothing is applied automatically, which keeps the brief's rule.
- **Reversal entries:** a wrong payment is reversed with a required note and never deleted. The receipt stays and shows as cancelled.
- **Audit log:** an append-only `audit_events` table, with a database trigger that refuses UPDATE and DELETE. A test proves it. This also closes the limit about upload corrections having no record.
- **Month-end check:** for a chosen month, one panel shows that ledger total, receipts total and Tally total agree, plus open queue items and any gap in receipt numbers. Recording when a month is closed gives the Scoreboard its real "days to close" figure.

**Traps found in the code**

- **`recordPayment` can't simply be called again.** `gateway_ref` is unique, so a repeat returns the old unmatched row and changes nothing. Add an explicit apply mode inside `lib/payments.ts`, taking the same lock, so it stays the only code that marks an instalment paid.
- **The schema blocks a reversed row.** The `matched_has_instalment` check requires that only matched rows have an instalment, so it has to change. A new `reversed` status is still the right choice, because the balance sums filter on `matched`. Check each sum anyway.
- **Reminders won't restart by themselves.** A full payment marks them stopped, and `planReminders` uses `onConflictDoNothing`, so those rows never come back. A reversal must requeue future stages only, so the parent doesn't get old ones.
- **Tally would quietly change.** The export filters on `matched`, so a reversed receipt would vanish from a month already imported. Export a contra row dated on the reversal day instead.
- **Saved refunds are frozen.** Refuse a reversal for a student who has left, because the refund used that money.
- **Dates use UTC.** `tallyReceipts` uses UTC day boundaries and `toISOString()`, so a payment just after midnight in India lands on the previous day, possibly in the previous month. Fix this here. It's a small change even if the rest of this idea is dropped.
- **Receipt numbers can have gaps.** The schema comment says "one unbroken series", but a Postgres sequence skips a number when a transaction rolls back. The check should report gaps, and the comment should be corrected.

**Keep it small.** Apply a queued payment only when it fits one instalment balance. Overpayments and money from students who have left stay in the queue, as a stated limit.

**In the interview:** "Nothing that touches money gets deleted. Every correction is a new entry, and the month-end totals have to agree."

---

## Seed changes these need

Do this once, before idea 2. Add new students after the existing ones, so the fixed random sequence doesn't shift the current sample.

| Add | Needed by |
|---|---|
| A second accounts user | Refund Desk |
| 5 or 6 students who left, with refunds at each step: inside the deadline, overdue, approved, paid, and ₹0 | Refund Desk, Risk Lab |
| Attendance that fades before those exits, in some cases but not all, plus one that stops without warning | Risk Lab |
| Some instalments paid over 60 days late | Scoreboard |
| A student whose balance equals the ₹12,500 unmatched payment | Close the Books |

The three brief students must stay exactly as they are. Update every document that says "49 students".

## Quick wins

Small jobs that turn a Partial into a Met or remove a doubt:

- **Measure the low-end phone claim.** `BRIEF-CHECK.md` says "not measured". Throttle parent home to slow 3G with a slowed CPU, then put the page weight and load time in the TDD.
- **Get the Hindi checked** by one native speaker, and record that it was done. It is listed as a gap in three documents.
- **Update the docs in the same commit** as each idea: the assumptions table in `CLAUDE.md`, TDD limits, `BRIEF-CHECK.md`, `prompt.md`, `deployment.md`.

## Left out on purpose

| Idea | Why not |
|---|---|
| A real trained model | There is no real dropout data, so any accuracy figure would be invented |
| An LLM chatbot or AI-written call notes | It sends minors' data to a third party for little gain, and the brief wants a flag a counsellor can trust |
| Real Razorpay or WhatsApp | The brief says to mock outside systems |
| Charts, dark mode, animation | `DESIGN.md` rules these out, and the client asked for restraint |
| Anything new on parent home | The five-second test is the brief's clearest design rule |
| Promise-to-pay, where a parent picks a later date and reminders pause | The best runner-up, as it targets the 12% directly. But it invents a fee policy the client never stated, and it weakens "reminders go out on their own". Put it under "Next" in the TDD |
