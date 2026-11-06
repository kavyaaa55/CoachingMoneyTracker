# Key Decisions

The choices that shaped this product, why each was made, and what was turned down. Every choice is backed by code or a test. For what went wrong along the way, see [mistakes.md](mistakes.md).

## The one idea behind the level-up

The core build met the brief. To go further I did not add breadth. I asked where a reviewer or the client would still have doubts, and found three places:

| Doubt | Answer |
|---|---|
| A reviewer cannot see a system that acts over weeks | Reviewer Console and time machine |
| Nothing reports the client's own success measures | Director Scoreboard |
| Our own limits list named the gaps | Refund Desk, Risk Lab, Close the Books |

The data pipeline sits under all five, because a demo is only as honest as the way its data was made.

## Data pipeline

| Decision | Why | Rejected |
|---|---|---|
| Sample data is replayed as events, day by day | Payments, receipts, reminders, flags and refunds become results of the real code. A seed that writes finished rows only proves the rows exist | Inserting finished rows |
| One event shape for every outside source | Gateway, counter, centre CSV, student leaving and refund steps all enter the same way, as they would in production | One code path per source |
| Each event goes to its real entry point | `recordPayment`, `saveUpload`, `saveRefund`. A replayed day and a live day cannot behave differently | A separate demo write path |
| `runDay` is the only daily pipeline | Cron, staff, replay and the time machine all call it | Separate logic for the demo |
| A failed stage is recorded and the next still runs | A provider outage must not block the risk check | Stopping at the first failure |
| Every run is stored in `pipeline_runs` | A job that stopped running is visible, and a missing day means something | Trusting the scheduler |
| Only enrolment is inserted directly | Admissions sit outside this product, so that is the true starting point | Replaying admissions too |
| The simulator only produces events | Simulated parents and centres go through the same pipeline, so the demo cannot cheat | Simulated rows |
| The simulator is deterministic | A hash of student and date, not a random number, so a demo plays out the same after each reset | `Math.random` |

**Production mapping.** The webhook, the counter form, the upload screen and cron are the live sources. `src/lib/simulator.ts` and `/staff/demo` are the only demo-only parts, and both refuse to run without `DEMO_MODE=true`.

## Reviewer Console

| Decision | Why | Rejected |
|---|---|---|
| Move the date, do not fake the output | Each day really runs, so reminders really fire and stop | A scripted animation |
| The date only moves forward, and Reset is the way back | Going back would leave reminders sent in the future | A free date picker |
| The moved date lives in memory, and recovers from `pipeline_runs` after a restart | `today()` stays synchronous across its 13 callers, so nothing else changed | Making the clock async |
| Refused at the lowest level, not only on the page | `lib/demo.ts` throws without demo mode, and a test proves it | A page-level check alone |

## Director Scoreboard

| Decision | Why | Rejected |
|---|---|---|
| Measure per rupee, and only instalments due 60 or more days ago | Newer instalments cannot be late yet, and counting them would flatter the figure | Share of all instalments |
| Money still unpaid after 60 days counts as late | It is the worst case of arriving late | Counting only paid-late money |
| Parent calls show "Not tracked yet" | The app has no call data, and `DESIGN.md` bans invented metrics | A proxy dressed up as the measure |
| "Paid within 3 days of a reminder", never "because of" | Timing does not prove cause | Claiming reminders caused payment |
| No rupee savings projected | 60 invented students cannot support a forecast | An ROI headline |
| Tables, no charts | `DESIGN.md` removed progress bars, and the client asked for restraint | A chart dashboard |

## Refund Desk

| Decision | Why | Rejected |
|---|---|---|
| One list, soonest deadline first | A legal deadline on one student's page is a deadline nobody watches | Checking each ledger |
| Second person must approve, enforced by a database check | The rule holds even if the code has a bug | A code check alone |
| Second person, no new role | The brief names two roles, so any other accounts user approves | An approver role |
| Paying issues the credit note in the same transaction | The two can never disagree | A separate step |
| A ₹0 refund skips approval | There is nothing to approve or pay | Forcing it through the steps |
| "Saving is final" stays | The steps come after saving and do not reopen the amount | Editable refunds |

## Risk Lab

| Decision | Why | Rejected |
|---|---|---|
| A tool that tests the fallback rule | A counsellor must see why, and a rule that can be checked beats a black box | A trained model on invented data |
| Replay sees only what was known that day | Otherwise the rule looks better than it was. This is the classic backtest mistake | Replaying on today's records |
| What-if numbers change nothing live | Live rules change only through a reviewed code change | Editable thresholds |
| "Late fees alone never flag" cannot be adjusted | It is a product rule, not a tuning number | Exposing it as a setting |
| Records that stop count as a sign, only if the batch has moved on | A late file for a whole class must not flag everyone | Any gap in records |
| Each flag stores its rule version | A false-flag rate always refers to a known rule | Unversioned flags |

## Close the Books

| Decision | Why | Rejected |
|---|---|---|
| Nothing that touches money is deleted | A correction is a new entry, so history stays true | Editing or deleting payments |
| A `reversed` status, not a separate table | Every balance sum already filters on `matched`, so all of them became correct at once | A reversals table joined everywhere |
| A reversal is its own Tally voucher on its own day | A month already imported stays as it was | Removing the original receipt |
| Reversal restarts future reminders only | The parent must never get old messages | Restarting all stages |
| Reversal is refused once a student has left | The saved refund used that money | Allowing it and fixing up later |
| Month end adds up the finished Tally file | Reading the real file catches a rounding slip in the GST split | Summing the rows that built it |
| Suggestions are plain rules, and a person always confirms | The brief says unmatched money marks nothing paid | Automatic matching |
| Money naming a student goes only to that student | A common amount is a coincidence, not evidence | Offering anyone with the same balance |
| Queued money can be returned to the payer | Otherwise a month with an overpayment could never close | Leaving it in the queue |
| A closed month refuses backdating | Closed means closed | Soft warnings |
| Audit log is append only, by database trigger | A log that can be edited proves nothing | A convention in code |
| All dates use India time | A payment just after midnight must land in the right month | UTC |

## AI layer

The brief says "an AI flag", and asks that it works, including when it is wrong or unsure. So Gemini gives the flag, and code holds the brief's hard lines around it. There are no new screens: it sits inside Call tasks, Risk Lab and Close the Books.

| Decision | Why | Rejected |
|---|---|---|
| Gemini gives the flag | The brief asks for an AI flag, and it can read a pattern a threshold misses. On the sample it raised a student whose records stopped, and flagged one the rule passed | Rules deciding, with AI only assisting |
| Hard lines stay in code, not in a prompt | A prompt can be ignored. Too little data is never sent, and late fees alone cannot flag, whatever the model says | Trusting the model to obey |
| Figures come from our records | The model picks which signs matter, and code fills in the numbers, so it cannot invent a fact | Showing the model's numbers |
| Rules are the fallback, and each task says who decided | Low confidence, a failure or no key means the rule decides, and staff can see that | A flag that hides its source |
| AI can add or clear a flag, but never removes an open task | Someone may already be acting on it, so it stays and says the AI did not confirm it | Tasks vanishing overnight |
| One anonymous call per run, for students with a sign | A made-up id, percentages and an overdue count. Cheap, private and fast | A call per student, or sending names |
| Replays stay offline | A term is 130 days, and a reset must be fast and repeatable. The final demo day is judged live | Calling the model for every past day |
| Learn each batch's normal pattern, using the median | A dip the whole batch shares, such as exam week, is not blamed on anyone. A median stops a few students in trouble hiding each other | Comparing a student only with themselves |
| Learn thresholds from who left and from false flags | The false flags counsellors mark finally feed back into the rule | A rate nobody acts on |
| Proposed numbers need a person to adopt them | A rule that silently rewrites itself cannot be trusted or explained | Self-updating thresholds |
| Gemini drafts a call guide for staff | Turns flag facts into a warm opening, in the parent's language | Showing raw figures only |
| Call guides never mention fees | A counsellor's call must not turn into a fee action, so the guide gets no fee reason | Sending every reason |
| The model reads a payer's note, and our code does the matching | It handles Hinglish like "doosri kist", while hints are checked against real students, so it cannot invent one | Letting the model choose the student |
| Names are masked before a note leaves | Most students are minors, so the model sees `NAME_1` | Sending the note as typed |
| Every draft is checked before anyone sees it | No money talk, links, long numbers or placeholders. A failed check uses the template | Trusting model output |
| Any failure falls back to plain rules | No key, a timeout or an outage never breaks a screen | Failing visibly |
| Every use is labelled and audited | Staff can see it is AI, and the audit log shows exactly what was sent | Hidden AI |
| `gemini-2.5-flash`, called with `fetch` | About 2 seconds, and no new dependency. A newer model hung in testing | An SDK, or the newest model by default |
| On demand, not on page load | Staff choose when to spend a call, and pages stay fast | Drafting on every render |

## Security

The full results are in [security.md](security.md).

| Decision | Why | Rejected |
|---|---|---|
| Never refuse real money over a detail | A payment that already happened must reach the queue | Strict validation on the webhook |
| Sign-out raises a version in the database | A stolen token dies at once, with one integer per user | A session table, or waiting for expiry |
| Late money posts on today's date | A closed month stays closed, and the money is still recorded | Reopening the month |
| Fix what is cheap and real, and list what is accepted | A short honest list beats claiming nothing is left | Claiming the app is secure |

## Production basics

The figures are in [operations.md](operations.md).

| Decision | Why | Rejected |
|---|---|---|
| Measure at the client's real size before changing anything | The numbers showed two real problems and ruled out the rest | Guessing, or adding indexes up front |
| No new indexes | Every dashboard took under 150 ms at 2,600 students | Indexes with no evidence |
| Keep sending inside the row lock, in parallel with a timeout | "Check at send time" is the brief's sharpest rule, and 8 at a time was 7 times faster | A send queue, which this size doesn't need yet |
| Limits and locks live in Postgres | They hold across several servers with no new service | Redis |
| Stateless app, signed sessions | Any server can answer, so scaling out needs no redesign | Server-side sessions |
| Node 26 LTS everywhere, chosen by hand | Tests run on the version production uses, and Dependabot would otherwise offer short-lived releases | Accepting every major bump |
| CI builds and boots the Docker image | Docker isn't on the dev machine, so CI is the proof | Trusting an untested Dockerfile |

## Foundations, kept from the core build

| Decision | Why |
|---|---|
| Money is whole paise | Sums never drift |
| Dates are `YYYY-MM-DD` strings | A due date has no time zone |
| Paid amount is calculated from payments | Balance can never disagree with history |
| Only `lib/payments` marks an instalment paid | One place to audit |
| Reminders stop in two places, on payment and at send time | The brief's hardest rule gets two checks |
| One lock shared by payments, reminders and refunds | A payment cannot slip in during a send |
| Only a signed webhook records a gateway payment | The browser is never trusted to say it paid |
| Parent home stays amount, date and pay button | The brief's five-second test |

## Turned down

| Idea | Why not |
|---|---|
| A trained dropout model | No real dropout data, so any accuracy figure would be invented. The batch baseline and the Risk Lab learn from data without claiming one |
| A parent chatbot | It breaks the five-second design rule |
| Real Razorpay or WhatsApp | The brief says to mock outside systems |
| Promise-to-pay | The best runner-up, but it invents a fee policy the client never stated |
| Charts, dark mode, animation | `DESIGN.md` rules these out |
| A new dependency | Nothing here needed one |
