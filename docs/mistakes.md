# Mistakes and Recovery

What went wrong, how it was caught, how it was fixed, and what changed as a result. Most of these were found by using the product, not by reading the code. The choices themselves are in [decisions.md](decisions.md).

## The pattern

Passing tests did not catch the worst ones. Three times a test agreed with the bug, because the test had the same wrong idea as the code. The fix each time was to look at the real screen with real data.

## Product mistakes

### 1. A leaver's money was offered to strangers

- **What happened:** the queue suggested applying a ₹30,000 payment from a student who had left to three unrelated students, because they each owed ₹30,000.
- **How it was caught:** looking at the Close the Books page in a browser. All the unit tests passed, because they described the same wrong rule.
- **Risk:** one click would have credited money to the wrong family.
- **Fix:** money naming a student goes only to that student. An exact balance counts only when exactly one student has it.
- **Lesson:** a common amount is a coincidence, not evidence. Test what a rule should refuse, not only what it should find.

### 2. October could never close

- **What happened:** a month closes only with an empty queue, but an overpayment or a leaver's money had no way out of the queue. One such payment would block every later close.
- **How it was caught:** walking the month-end flow to its last step.
- **Fix:** staff can return queued money to the payer, with a required note and an audit entry. The row stays as the record.
- **Lesson:** every queue needs an exit for each thing that can enter it.

### 3. "Stopped" always showed zero

- **What happened:** the pipeline table showed 0 reminders stopped on every day, which hid the product's main promise.
- **How it was caught:** reading the numbers on the console after paying a fee.
- **Cause:** a payment stops reminders the moment it arrives, before the daily job runs, so the job had nothing left to count. The system was right and the report was wrong.
- **Fix:** each run now counts every stop since the last run.
- **Lesson:** a metric that never moves is a bug until proven otherwise.

### 4. Month-end dates used UTC

- **What happened:** a payment just after midnight in India landed on the previous day, and possibly the previous month.
- **How it was caught:** it was on the known limits list. Building month end made it matter.
- **Trap:** an existing test used `23:59:59Z` as the last second of September, so it had the bug written into it.
- **Fix:** all receipt and export dates use India time, and the test now uses the true India month edges. The assertion was not weakened.
- **Lesson:** when a fix breaks a test, ask which of them is wrong.

### 5. A student whose records stopped looked steady

- **What happened:** the risk flag read only the records it had, so a student who stopped being recorded, probably the likeliest dropout, could never be flagged.
- **How it was caught:** reviewing the limits list while designing the Risk Lab.
- **Fix:** two weeks behind the rest of the batch is now a sign. Comparing with the batch stops a late file from flagging a whole class.
- **Lesson:** missing data is data.

### 6. "Flags exactly three students" was only true on one date

- **What happened:** the docs and a test said the rule flags exactly three sample students. Replaying the term day by day found a fourth, Uday Vyas, whose attendance dipped in October.
- **Cause:** the old seed ran the check once, on the demo date. Run daily, as in production, the rule behaves differently.
- **Fix:** the docs now state what the replay shows. The Lab shows the rule also missed 2 of 6 leavers, which the old demo could never have shown.
- **Lesson:** a demo that runs once cannot show how a daily system behaves.

### 7. The sample data could not show the client's main measure

- **What happened:** no sample payment arrived more than 9 days late, so the brief's "over 60 days late" measure had nothing to measure.
- **How it was caught:** reading `sample-data.ts` before designing the Scoreboard.
- **Fix:** added late payers, students who left, a silent student and a real queue match. New students were added last, so the fixed random sequence did not change the existing ones.
- **Lesson:** check that your sample data can tell the story before you build the screen.

### 8. The data pipeline was static

- **What happened:** the seed wrote finished rows, and even rebuilt reminder history by hand. The demo looked alive but none of its history came from the product's own code.
- **How it was caught:** owner review.
- **Fix:** sample data is now replayed as events through the real entry points. The whole term replays in about 15 seconds, fast enough for a live reset button.
- **Lesson:** this also found mistake 6, and gave real receipt numbers for free.

### 9. A comment claimed something false

- **What happened:** the schema said receipts were "one unbroken series". A Postgres sequence can skip a number when a transaction rolls back.
- **Fix:** the comment now tells the truth, and month end reports any gap.
- **Lesson:** a confident comment is a claim, so check it.

### 10. There was no real AI layer

- **What happened:** the "AI flag" was fixed rules, and the first plan argued that was enough.
- **How it was caught:** owner review, who asked whether an actual layer existed. It did not.
- **Fix:** batch baselines and thresholds now learn from data, and Gemini drafts call guides and reads payer notes, all with fallbacks.
- **Still wrong:** that layer sat around the flag, and rules still made the decision. Comparing it line by line with the brief showed this, and the owner was right to say the AI should give the flag.
- **Final fix:** Gemini now gives the flag, code holds the hard lines, and rules are the fallback. On the sample it flagged a student the rule had passed.
- **Lesson:** an honest label does not replace the feature the brief asked for. Compare against the brief's exact words before calling something done.

### 11. The consent notice did not cover the risk check or AI

- **What happened:** the notice said data was used for dues and reminders only. It never mentioned the risk check, and then data started going to an AI provider.
- **How it was caught:** comparing the build with the brief's DPDP line.
- **Fix:** the notice now names both in Hindi and English, and its version went up, so parents agree again.
- **Lesson:** a new use of data changes what parents agreed to, so check the notice whenever data use changes.

### 12. The safety check blocked every good AI draft

- **What happened:** the check rejected anything containing "fee", which also matched "**fee**ling". Every draft quietly became the template.
- **How it was caught:** three live Gemini calls in a row showed "Standard guide". All the tests used fake replies that avoided the word.
- **Fix:** whole-word matching, and a test for "feeling".
- **Lesson:** test against real model output, not only replies you wrote yourself.

### 13. Gemini left a placeholder in a draft

- **What happened:** the first live draft said "calling from [Institute Name]".
- **How it was caught:** reading the first real output.
- **Fix:** the prompt forbids placeholders, and the check rejects brackets.
- **Lesson:** a model's first real answer will show you a case you did not imagine.

### 14. An empty API key would have crashed the app

- **What happened:** `.env.example` ships `GEMINI_API_KEY=` empty, and validation refused an empty value, so the optional feature could stop the whole app starting.
- **How it was caught:** running the tests with the key set to empty.
- **Fix:** an empty value now means "no key".
- **Lesson:** optional must mean optional in every form it can arrive.

### 15. Month-end would have crashed on real data

- **What happened:** monthly totals were cast to a 32-bit integer. The 60-student sample never got near the limit, but this client's real months would pass about ₹2.1 crore, and Close the Books would stop with `integer out of range`.
- **How it was caught:** asking what happens at the client's real volume, then proving it with a test that failed.
- **Fix:** totals are no longer cast down.
- **Lesson:** sample data hides scale. Test with the client's numbers, not your own.

### 16. A long note could lose real money

- **What happened:** the webhook refused a note over 200 characters with a 400, so the payment was dropped instead of reaching the queue.
- **How it was caught:** a hostile webhook in the attack script.
- **Fix:** a long note is trimmed, and an oversized reference goes to the queue.
- **Lesson:** validation that refuses input is safe for a form and dangerous for money that has already moved.

### 17. "Closed means closed" had three holes

- **What happened:** a late webhook, a refund date, or a date before the first close could still change a closed month.
- **How it was caught:** reading every path that writes a date after building the check on only two of them.
- **Fix:** every path now respects the close, and late money posts on today's date.
- **Lesson:** a rule is only as strong as the write path you forgot.

## Process mistakes

### 18. A commit went in with two failing tests

- **What happened:** one long command used `;` between steps, so the commit ran after tests had failed.
- **How it was caught:** reading the output straight after.
- **Fix:** it had not been pushed, so the commit was amended after the fix, and the history never carried a failing commit.
- **Lesson:** gate commits with `&&`, so a failure stops the chain.

### 19. Test data did not match its own story

- **What happened:** a test for "two weeks behind" failed. The code was right, but the test miscounted its own weeks.
- **Fix:** corrected the test data after checking which side was wrong.
- **Lesson:** a failing test is a question, not a verdict.

### 20. Tests relied on local settings

- **What happened:** the time-machine tests passed locally only because `.env` turns demo mode on. CI has no such setting, so they would have failed after the push.
- **How it was caught:** reading the CI file before pushing, then running the suite with CI's settings.
- **Fix:** the tests now set up their own environment.
- **Lesson:** check that tests pass with CI's settings, not only your own.

### 21. Tooling friction

| Problem | Recovery |
|---|---|
| Long shell scripts with apostrophes failed with `unexpected EOF` | Write script files with the editor, then run them |
| A patch script failed on Windows line endings | The helper now normalises line endings |
| The token-saving shell wrapper rejected `next start -p` | Run `node node_modules/next/dist/bin/next start --port 3000` |
| A shell heredoc turned the regex `\\b` into a backspace character | Write anything with backslashes using the editor, never a heredoc |

## Mistakes from the core build

Found by the 360px polish pass and browser testing:

| Mistake | Fix |
|---|---|
| Forms cleared every field after a validation error | `ActionForm` restores what was typed |
| A day count of `-0` on the due date | Handled in the date rules |
| Sample data put every overdue student in NEET batches | Spread across every batch and centre, with a test |
| A Hindi button overflowed its box | Fixed, and every screen checked in both languages |
| An export would have broken the production build | Caught by running the build, which CI now does |

## What changed in how the work is done

1. Walk every flow to its last step in a browser. Mistakes 1, 2 and 3 were invisible to tests.
2. Read the numbers on screen and ask if they make sense.
3. For each rule, write down what it must refuse.
4. Run the system the way production runs it, daily, not once.
