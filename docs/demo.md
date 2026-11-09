# Try Fee Tracker: a hands-on test guide

Fee Tracker helps a coaching institute collect fees. Parents see what they owe and pay on their phone. The accounts team sees who owes what, sends reminders, and works out refunds.

This guide walks you through everything the app does, one small mission at a time. You do not need to know how it is built. Each step tells you what to do and exactly what you should see.

**Time needed:** about 15 minutes to set up, then about an hour for the missions.

## How to use this guide

1. Keep this guide open next to the app.
2. Follow each mission, and tick its boxes as you go.
3. Compare the screen with the **You should see** line.
4. If something does not match, open the **Stuck?** note under that mission. If that does not help, write it down and carry on.
5. At the end, fill in the [scorecard](#scorecard) and send it to the team.

> [!IMPORTANT]
> **Do the missions in order, starting from fresh sample data.** Each mission changes the data, and the figures in later missions depend on those changes. To start again, see [Start over](#start-over).

## Three things that will seem odd

| What you will notice | Why |
|---|---|
| The app thinks today is **2 Nov 2026**, whatever your calendar says | The date is fixed, so everyone sees the same results, such as "23 days overdue" |
| No text message arrives, and the sign-in code appears **on the screen** | Text messages are switched off for testing |
| Paying uses a **Test payment gateway** page | No real money moves. This page stands in for a real payment service, and lets you choose what happens |

All the people and phone numbers are made up.

## Who is who

You sign in by typing one of these numbers.

| Number | Who you are | Used in |
|---|---|---|
| `9000000002` | Parent of **Ishita Sharma**, who has an overdue fee | Missions 1 and 2 |
| `9000001035` | Parent of two children, **Aditi** and **Vidhi Jain** | Mission 3 |
| `9000000001` | Parent of **Aarav Meena**, who is up to date | Mission 3 |
| `9000001007` | Parent of **Rohan Saini**, who has paid the whole year | Mission 3 |
| `9000000003` | Parent of **Mohit Gurjar**, who is going to leave | Missions 3 and 10 |
| `9000001005` | Parent of **Chirag Choudhary**, whose attendance is about to drop | Mission 9 |
| `9000001040` | Parent of **Manav Shekhawat**, who has very few records | Mission 9 |
| `9000000100` | **Accounts staff** at the institute | Missions 4 to 10 |

## Your missions

- [ ] [Get the app running](#get-the-app-running)
- [ ] [Mission 1: Sign in and give permission](#mission-1-sign-in-and-give-permission)
- [ ] [Mission 2: Pay a fee, and try what can go wrong](#mission-2-pay-a-fee-and-try-what-can-go-wrong)
- [ ] [Mission 3: Meet the other families](#mission-3-meet-the-other-families)
- [ ] [Mission 4: See who owes what](#mission-4-see-who-owes-what)
- [ ] [Mission 5: Look up one student](#mission-5-look-up-one-student)
- [ ] [Mission 6: Record a payment made at the counter](#mission-6-record-a-payment-made-at-the-counter)
- [ ] [Mission 7: Send the day's reminders](#mission-7-send-the-days-reminders)
- [ ] [Mission 8: Check on students who may drop out](#mission-8-check-on-students-who-may-drop-out)
- [ ] [Mission 9: Upload attendance and test scores](#mission-9-upload-attendance-and-test-scores)
- [ ] [Mission 10: Refund a student who left](#mission-10-refund-a-student-who-left)
- [ ] [Mission 11: Check it on a phone screen](#mission-11-check-it-on-a-phone-screen)

---

## Get the app running

You will copy a few commands into a **terminal**, the window where you type instructions to your computer. On Windows, open PowerShell from the Start menu. On a Mac, open Terminal.

**Install these first** (skip any you already have):

- [ ] [Node.js](https://nodejs.org), version 22 or later
- [ ] [PostgreSQL](https://www.postgresql.org/download/), which stores the app's data. It asks you to choose a password, so keep that password handy
- [ ] [Git](https://git-scm.com/downloads), which downloads the code

**Then:**

- [ ] **1. Download the app.** If it asks for access, ask the repository owner.

  ```
  git clone https://github.com/kavyaaa55/CoachingMoneyTracker.git
  cd CoachingMoneyTracker
  npm install
  ```

- [ ] **2. Create the settings file.** Paste this as one line. It makes a file called `.env` and fills in the secret keys for you. It replaces any `.env` already there, so skip this step if you have one.

  ```
  node -e "const fs=require('fs'),c=require('crypto');let t=fs.readFileSync('.env.example','utf8');for(const k of ['SESSION_SECRET','GATEWAY_WEBHOOK_SECRET','CRON_SECRET'])t=t.replace(k+'=',k+'='+c.randomBytes(32).toString('hex'));fs.writeFileSync('.env',t)"
  ```

- [ ] **3. Add your database password.** Open `.env` in any text editor and find this line:

  ```
  DATABASE_URL=postgres://postgres:password@localhost:5432/fee_tracker
  ```

  Replace the word `password` with the PostgreSQL password you chose, then save the file.

- [ ] **4. Create an empty database.** It may ask for that password again.

  ```
  createdb -U postgres fee_tracker
  ```

  If your computer says `createdb` is not recognised, use pgAdmin instead, which installs with PostgreSQL. Right-click **Databases**, choose **Create**, then **Database**, and name it `fee_tracker`.

- [ ] **5. Load the sample data.**

  ```
  npm run db:migrate
  npm run db:seed
  ```

  **You should see:** `Replayed the term for 60 students.`

- [ ] **6. Start the app.** Leave this terminal open while you test.

  ```
  npm run dev
  ```

- [ ] **7. Open the app.** Go to <http://localhost:3000> in your browser.

  **You should see:** a page asking you to choose a language, with the buttons **हिन्दी** and **English**.

<details>
<summary><strong>Stuck?</strong></summary>

See [When something goes wrong](#when-something-goes-wrong). Most setup problems are a wrong password or port in `.env`.

</details>

---

## Mission 1: Sign in and give permission

**You are:** the parent of Ishita Sharma, who prefers Hindi.

**Why it matters:** students are children, so the law requires a parent's permission before their records are shown. Parents also need to be able to use the whole app in Hindi.

You do not need to read Hindi. This table covers every Hindi label in this mission.

| Hindi on screen | Meaning |
|---|---|
| कोड भेजें | Send code |
| साइन इन करें | Sign in |
| मैं माता-पिता या अभिभावक हूँ और मैं सहमत हूँ | I am the parent or guardian and I agree |
| अभी नहीं | Not now |
| साइन आउट करें | Sign out |

**Try a mistake first:**

- [ ] Click **हिन्दी**.
- [ ] Type `12345` as the mobile number, and click **कोड भेजें**.

  **You should see:** a red message asking for a 10-digit number.

**Now sign in, with one wrong code:**

- [ ] Type `9000000002` and click **कोड भेजें**.

  **You should see:** a yellow box showing a 6-digit code. In real use, this would arrive by text message.

- [ ] Type `000000` and click **साइन इन करें**.

  **You should see:** a red message saying the code is wrong. You stay on this page.

- [ ] Type the real code from the yellow box and click **साइन इन करें**.

  **You should see:** a permission page that names Ishita Sharma and explains what is collected and why. No fee details appear yet.

**Say no, then yes:**

- [ ] Click **अभी नहीं** (Not now).

  **You should see:** you are signed out and back at the sign-in page. Nothing about Ishita was shown.

- [ ] Sign in again with `9000000002`, using the new code on screen.

  **You should see:** the permission page again, because you have not agreed yet.

- [ ] Click the agree button.

  **You should see:** Ishita's home page, shown below. It has the amount **₹15,000**, the due date, **23 days late** (23 दिन की देरी), and one big pay button.

<img src="screenshots/parent-home-hindi.png" alt="Parent home page in Hindi, showing ₹15,000 and a pay button" width="260">

**Switch language and look around:**

- [ ] Click **English** at the top right.

  **You should see:** the same page in English: **Ishita Sharma owes ₹15,000**, **Due 10 Oct 2026 · 23 days overdue**. The rest of this guide uses English.

- [ ] Click **See all instalments**. An instalment is one part of the yearly fee.

  **You should see:** four instalments of ₹30,000. The first is **Paid**. The second is **Part paid, 23 days overdue** with **₹15,000 left to pay**. The last two are not due yet.

- [ ] Click **Back**.

<details>
<summary><strong>Stuck?</strong></summary>

- **Too many codes requested:** you asked for more than 5 codes for one number in 10 minutes. Wait, or [start over](#start-over).
- **Code expired:** codes last 5 minutes. Click the "send a new code" link under the form.

</details>

---

## Mission 2: Pay a fee, and try what can go wrong

**You are:** still Ishita's parent.

**Why it matters:** the institute must never mark a fee as paid unless the right money arrived. This mission tests all the ways a payment can go.

Click **Pay ₹15,000** on the home page to reach the Test payment gateway. Under **Try another outcome** you can act out problems that happen with real payments. Do them in this order. Each time you return to the home page, click the pay button again.

- [ ] **The payment fails.** Click **Payment fails**.

  **You should see:** a red message, "Payment failed. No money was taken." You stay on the same page.

- [ ] **Paying only part.** Click **Pay part: ₹7,500**.

  **You should see:** **Payment received.** with a **View receipt** link. The amount owed drops to **₹7,500**.

- [ ] **Paying too much.** Open the gateway again and click **Pay too much: ₹8,500**.

  **You should see:** "We received your payment. Our accounts team is checking it." The amount owed stays at **₹7,500**, because the app will not guess what extra money was for.

- [ ] **A payment with no reference.** Open the gateway again and click **Payment with no reference**. This is money that arrives without saying who it is for.

  **You should see:** the same "checking it" message. The amount owed stays at **₹7,500**.

- [ ] **Copy the page address.** Open the gateway again. Copy the address from the browser's address bar and paste it into a notepad.

- [ ] **Paying in full.** Click the big **Pay ₹7,500** button.

  **You should see:** **Payment received.** The page moves on to **Next payment for Ishita Sharma, ₹30,000, Due 10 Jan 2027**.

**Check the receipt:**

- [ ] Click **View receipt**.

  **You should see:** a new receipt with the next number in the series and the tax split out. These lines add up to the total:

  | Line | Amount |
  |---|---|
  | Fee before tax | ₹6,355.93 |
  | CGST 9% | ₹572.03 |
  | SGST 9% | ₹572.04 |
  | Total paid | ₹7,500 |

  The tax number and rate are samples, and the receipt says so.

- [ ] Click **Print receipt** to check the print window opens, then close it.

**Try to break it:**

- [ ] Paste the address you copied earlier into the address bar and press Enter.

  **You should see:** "This instalment is already paid." You cannot pay twice.

- [ ] Go to <http://localhost:3000/gateway/not-a-real-link>.

  **You should see:** "This payment link has expired."

- [ ] Go to <http://localhost:3000/staff/dues>, which is a staff page.

  **You should see:** you are sent back to your own home page. Parents cannot see staff pages.

**Read the refund policy:**

- [ ] Go to <http://localhost:3000/refund-policy>.

  **You should see:** a plain page explaining how refunds work, with a worked example ending in **₹10,808**. Anyone can read it without signing in.

- [ ] Go back to <http://localhost:3000> and click **Sign out** at the top right.

<details>
<summary><strong>Stuck?</strong></summary>

- **Every payment says it failed:** the `APP_URL` line in `.env` must match the address in your browser. See [When something goes wrong](#when-something-goes-wrong).
- **The amounts differ from this guide:** the steps were done in a different order. [Start over](#start-over).

</details>

---

## Mission 3: Meet the other families

**Why it matters:** the home page has to make sense for every family, whatever their situation.

Sign in with each number and agree to the permission page. Sign out after each one.

- [ ] **`9000001035`, a parent of two.**

  **You should see:** the permission page lists **both** children. The home page then has two names at the top, **Aditi** and **Vidhi**. Aditi owes **₹15,000**. Click **Vidhi** to see **₹40,000, Due in 13 days**.

- [ ] **`9000000001`, up to date.**

  **You should see:** **Next payment for Aarav Meena, ₹30,000, Due in 69 days**. Nothing is shown in red, because nothing is late.

- [ ] **`9000001007`, the whole year paid.**

  **You should see:** **All paid**, **Nothing is due right now.** There is no pay button.

- [ ] **`9111111111`, a number the institute does not know.**

  **You should see:** "this number is not registered, so no code was created." Click **Use a different number** to go back.

- [ ] **`9000000003`, Mohit's parent.**

  **You should see:** **Next payment for Mohit Gurjar, ₹40,000, Due in 13 days**.

  Mohit is going to leave in Mission 10, so we need something for later. Click **Pay ₹40,000**, copy the page address into your notepad and label it "Mohit". **Do not pay.** Go back to <http://localhost:3000> and sign out.

---

## Mission 4: See who owes what

**You are:** the accounts staff. Sign in with `9000000100`.

**Why it matters:** this page replaces chasing four centres for their figures.

- [ ] You land on **Dues**. Check the four totals at the top.

  **You should see:**

  | Figure | Amount | What it means |
  |---|---|---|
  | Billed | ₹58,20,000 | All fees for the year |
  | Collected | ₹19,99,000 | Money received and matched to a fee |
  | Outstanding | ₹38,21,000 | Everything still unpaid, including fees not due yet |
  | Overdue | ₹6,01,000 | The part of that past its due date |

- [ ] Look at **Overdue by age**, which shows how late the money is.

  **You should see:**

  | How late | Amount | Students |
  |---|---|---|
  | Up to 30 days | ₹1,77,000 | 7 |
  | 31 to 60 days | ₹1,17,000 | 5 |
  | Over 60 days | ₹3,07,000 | 10 |

**Find your problem payments:**

- [ ] Scroll to **Unmatched payments (3)**. This is the holding list for money the app could not place.

  **You should see:** the two payments from Mission 2, plus one that was already there.

  | Amount | Why it is here | Student |
  |---|---|---|
  | ₹8,500 | More than the balance | STU-0587 (Ishita) |
  | ₹7,500 | No instalment matches | Unknown |
  | ₹12,500 | No instalment matches | Unknown |

  None of this money counts as Collected. Staff can see this list, but cannot yet move a payment from it onto a fee. That is a known limit.

**Filter by centre:**

- [ ] Choose **Centre 3** and click **Show**.

  **You should see:** the figures change to that centre, with Billed **₹14,40,000**.

- [ ] Also choose the batch **NEET 2028 Morning** and click **Show**.

  **You should see:** "No dues match these filters." That batch does not run at Centre 3.

- [ ] Click **Clear**.

**Export for the accountant:**

Tally is the accounting software the centres use. This export gives it a spreadsheet of receipts.

- [ ] Scroll to **Tally export**. Set **From** after **To**, then click **Download Tally CSV**.

  **You should see:** "Check the dates. The start must be on or before the end."

- [ ] Set **From** to 1 Jan 2025 and **To** to 31 Jan 2025, then click the button again.

  **You should see:** "No receipts in these dates, so there is nothing to export."

- [ ] Set **From** to 1 Oct 2026 and **To** to 2 Nov 2026, click the button, and open the file in Excel or Google Sheets.

  **You should see:** your receipts for Ishita's ₹7,500 payments among the others, plus any Reversal and Credit Note vouchers. Each row splits out the fee, CGST and SGST. Rows show the student ID but no names, and the unmatched payments are not there.

<img src="screenshots/staff-dues.png" alt="Dues page with totals, overdue amounts and a table by centre and batch" width="640">

*Your figures will differ from this picture, which was taken at a different point. Trust the tables above.*

---

## Mission 5: Look up one student

**You are:** still the accounts staff.

**Why it matters:** when a parent calls, staff need the full story on one page. The app calls this page the **ledger**.

- [ ] Click **Students** in the menu.

  **You should see:** **60 students**.

- [ ] Search for each of these in turn: `Ishita`, then `STU-0587`, then `9000000002`.

  **You should see:** Ishita Sharma each time, so name, student ID and phone number all work.

- [ ] Search for `zzzz`.

  **You should see:** `No students match "zzzz".`

- [ ] Search for `Ishita` again and click her name.

  **You should see:**

  - **Fee plan** ₹1,20,000, **Paid** ₹60,000, **Balance** ₹60,000, **Overdue** ₹0
  - Instalments 1 and 2 both **Paid**, thanks to Mission 2
  - Four payments: ₹30,000, ₹15,000, and your two of ₹7,500
  - **Dropout risk:** "No signs of risk right now."

---

## Mission 6: Record a payment made at the counter

**You are:** still the accounts staff. Isha Jain's parent has just paid ₹30,000 by UPI at the centre. (Isha Jain and Ishita Sharma are different students.)

**Why it matters:** this shows that staff typing errors are caught, and that reminders stop the moment a fee is paid.

**First, look at her reminders:**

- [ ] Click **Reminders** in the menu and search for `Isha Jain`.

  **You should see:** **Queued (4)**. Four reminders are waiting to go out, including one for today.

- [ ] Click her name, then **Record payment**.

**Make some mistakes:**

- [ ] Keep **Instalment 2** selected. Type `35000` as the amount and click **Save payment**.

  **You should see:** "This is more than the balance on this instalment. Nothing was saved."

- [ ] Type `0` and click **Save payment**.

  **You should see:** "Enter an amount above zero, such as 15000."

- [ ] Type `30000` and set **Payment date** to 3 Nov 2026, which is tomorrow in the app. Click **Save payment**.

  **You should see:** the browser refuses, saying the date must be 2 Nov 2026 or earlier. Nothing is saved.

**Now do it properly:**

- [ ] Fill in the form:

  | Field | Value |
  |---|---|
  | Instalment | Instalment 2 |
  | Amount in rupees | `30000` |
  | Paid by | UPI |
  | Reference | `UPI-DEMO-1` |
  | Payment date | 2 Nov 2026 |

- [ ] Click **Save payment**.

  **You should see:** **Payment recorded.** The ledger now shows **Paid ₹60,000** and **Balance ₹60,000**.

- [ ] Click **View receipt**.

  **You should see:** a receipt with the GST split, the same as the parent's.

**Check that the reminders stopped:**

- [ ] Click **Reminders** and search for `Isha Jain` again.

  **You should see:** **Queued (0)** and **Stopped (8)**. The four waiting reminders now say **Stopped: Paid**.

---

## Mission 7: Send the day's reminders

**You are:** still the accounts staff.

**Why it matters:** reminders go out on their own 7 days and 1 day before a due date, on the day itself, then at intervals after it until the fee is paid. A parent who has paid must never get one. In real use this runs each day by itself. The button lets you run it now.

- [ ] Click **Reminders** in the menu, which also clears your search.

  **You should see:** **All (643)**, **Queued (89)**, **Sent (383)**, **Stopped (171)**.

- [ ] Search for `Ishita`.

  **You should see:** **Queued (0)**. Her reminders for 7 Nov and 14 Nov say **Stopped: Paid**, because of what you paid in Mission 2.

- [ ] Click **Reminders** again, then **Run reminders now**.

  **You should see:** "Done. Sent 4, stopped 0." and **Queued (85)**, **Sent (387)**.

- [ ] Click **Sent**.

  **You should see:** these four at the top, dated 2 Nov 2026. **Isha Jain is not among them**, even though she had a reminder due today. Mission 6 stopped it.

  | Student | Stage | Language |
  |---|---|---|
  | Aditi Shekhawat | 7 days before | English |
  | Gauri Joshi | 1 day before | Hindi |
  | Ojas Soni | 7 days after | Hindi |
  | Tanmay Shekhawat | 3 days after | Hindi |

- [ ] Click **View message** on Aditi Shekhawat, then on Gauri Joshi.

  **You should see:** each message names the student and the amount, and has a link to pay. Aditi's is in English and Gauri's is in Hindi, matching what each parent prefers.

- [ ] Click **Reminders** in the menu, then **Run reminders now** again.

  **You should see:** "Done. Nothing was due today." No parent gets a second message.

---

## Mission 8: Check on students who may drop out

**You are:** still the accounts staff, acting as the counsellor.

**Why it matters:** the app spots students who may be about to leave, so someone can call the family. It must be careful. A flag only creates a phone call for staff. It never changes a fee or messages a parent. Being late with fees is not enough on its own, because that is a money problem and not a sign of leaving.

**See how it decides:**

- [ ] Click **Students**, search for `Chirag Choudhary` and open his record.

  **You should see:** **₹30,000** overdue by **48 days**, yet **"No signs of risk right now."** His attendance and test scores are steady, so late fees alone do not flag him.

- [ ] Do the same for `Manav Shekhawat`.

  **You should see:** "Not enough attendance or test records to say yet, so no task was created." The app says so instead of guessing.

- [ ] Do the same for `Neha Joshi`.

  **You should see:** **High risk**, with the reasons in plain words: attendance fell from 83% to 42%, test scores fell from 59% to 37%, and 2 instalments are overdue.

**Work the call list:**

- [ ] Click **Call tasks** in the menu.

  **You should see:** five or six open tasks, including Chirag Joshi, Neha Joshi and Uday Meena as high. Each one says whether AI or the rule gave it, and without a Gemini key they all say the rule. Each one shows the reasons and a number to call. The page says "No flags reviewed yet".

  <img src="screenshots/staff-tasks.png" alt="Call tasks page listing three high risk students" width="520">

- [ ] On **Chirag Joshi**, leave the note empty and click **False flag**. A false flag means the app was wrong about this student.

  **You should see:** "Add a note saying why this flag is false."

- [ ] Type `Student was ill and is back in class.` in the note and click **False flag**.

  **You should see:** **Marked as a false flag.**, one fewer open task, and "False flags: 1 of 1 reviewed (100%)."

- [ ] On **Neha Joshi**, click **Called**. A note is optional here.

  **You should see:** **Marked as called.** and "False flags: 1 of 2 reviewed (50%)."

- [ ] Click **False flags** to find your note, then go back to **Open**.

- [ ] Click **Run risk check now**.

  **You should see:** "Checked 54 students. 0 new tasks. 1 had too little data, so no task was created." Chirag and Neha do not come back, because a reviewed student is left alone for 30 days.

**Prove nothing else changed:**

- [ ] Click **Dues**.

  **You should see:** **Collected ₹20,29,000** and **Outstanding ₹37,91,000**. That is Mission 4's figures plus Isha's ₹30,000 and nothing else. Reviewing a flag touched no fees.

---

## Mission 9: Upload attendance and test scores

**You are:** still the accounts staff.

**Why it matters:** each centre keeps attendance and test marks in its own spreadsheets. This brings them in one batch at a time. Parents can then see them, and the dropout check has real information to work with. One mistake in a file should never put wrong marks in front of a parent.

The sample files for this mission are in the `docs/samples` folder of the app.

**Try a file with mistakes:**

- [ ] Click **Upload** in the menu.

- [ ] For **Batch**, choose **Centre 3 · JEE 2028 Morning**. Leave **What is in the file** on **Attendance**.

  **You should see:** a new link, **Download a template for this batch**.

- [ ] Click that link and open the file.

  **You should see:** a spreadsheet listing the 6 students in this batch, with empty columns to fill in.

- [ ] Under **CSV file**, choose `attendance-with-mistakes.csv` and click **Check file**.

  **You should see:** "4 problems found. Nothing was saved." Each one names its line in the file:

  | Line | Problem |
  |---|---|
  | 2 | Present is more than total: 7 / 6 |
  | 3 | STU-0412 is not in this batch |
  | 4 | 2026-10-28 is not a Monday |
  | 5 | 2026-11-09 is in the future |

**Now a good file:**

- [ ] Choose `attendance-centre-3.csv` and click **Check file**. This file says Chirag Choudhary has almost stopped coming to class.

  **You should see:** **Check before saving**, with "1 new, 3 changed, 0 already saved". Changed rows show the old value, such as **1 of 6 classes (was 5 of 6 classes)**. Nothing is saved yet.

- [ ] Click **Save 4 records**.

  **You should see:** "Saved. 1 new, 3 changed."

**See what it changes:**

- [ ] Click **Call tasks**.

  **You should see:** no task for Chirag Choudhary yet. Saving a file does not raise a flag by itself, so staff can finish entering a whole batch first.

- [ ] Click **Run risk check now**.

  **You should see:** "Checked 54 students. 1 new task." **Chirag Choudhary** now appears as **Watch**, with "Attendance fell from 91% to 8%" and "1 instalment overdue". In Mission 8, the same student showed no signs of risk.

**Upload the same file twice:**

- [ ] Click **Upload**, choose the same batch and `attendance-centre-3.csv`, and click **Check file**.

  **You should see:** "Everything in this file is already saved, so there is nothing to do." There is no save button.

- [ ] Click **Use a different file**.

**Add a test score:**

- [ ] Choose the same batch, set **What is in the file** to **Test scores**, choose `test-scores-centre-3.csv`, and click **Check file**.

  **You should see:** **Unit Test 7, 1 Nov 2026: 195 of 300**, marked **New**. The file writes the date day first, the way Excel does, and it is still read correctly.

- [ ] Click **Save 1 record**, then **Sign out**.

**See it as a parent:**

- [ ] Sign in with `9000001005` and agree to the permission page.

  **You should see:** **Chirag Choudhary owes ₹30,000**. The home page has not changed, and nothing mentions the risk flag.

- [ ] Click **See all instalments**, then **Attendance and test scores** near the bottom.

  **You should see:** **Last 4 weeks: 2 of 24 classes (8%)**, then a list of weeks. Under **Test scores**, **Unit Test 7** is at the top with **195 / 300** and **65%**.

- [ ] Click **हिन्दी** at the top right.

  **You should see:** the same page in Hindi. Click **English** to switch back, then sign out.

- [ ] Sign in with `9000001040` and agree to the permission page. Open **See all instalments**, then **Attendance and test scores**.

  **You should see:** **Latest week: 4 of 6 classes (67%)**, and "No test scores have been recorded yet." The page says so plainly instead of looking broken.

- [ ] Sign out, then sign in again as staff with `9000000100`.

<details>
<summary><strong>Stuck?</strong></summary>

- **The file is refused for a reason not listed here:** check you chose **Centre 3 · JEE 2028 Morning**, because the app only accepts students from the chosen batch.
- **"This is not a CSV file":** in Excel, choose **Save As**, then **CSV UTF-8**.

</details>

---

## Mission 10: Refund a student who left

**You are:** still the accounts staff.

**Why it matters:** when a student leaves, the rules say the institute keeps only the fee for the days used, and refunds the rest within 10 days. The working has to be clear enough to show a parent.

The sum is:

> **Fee used** = yearly fee × days attended ÷ 365
>
> **Refund** = amount paid − fee used

**Practise on Ishita, without saving:**

> [!CAUTION]
> Do **not** click **Save refund and stop reminders** while practising on Ishita. Saving cannot be undone.

- [ ] Open Ishita Sharma's record and click **Work out refund**.

- [ ] Set **Date the student left** to 12 Oct 2026 and click **Work out refund**.

  **You should see:**

  | Line | Value |
  |---|---|
  | Days used | 104 of 365 |
  | Fee used | ₹34,192 |
  | Paid so far | ₹60,000 |
  | **Refund due** | **₹25,808** |
  | Due by | 22 Oct 2026 · 11 days overdue |

  The picture below shows the same page before Mission 2, when she had paid ₹45,000. That gives ₹10,808, the example on the refund policy page.

  <img src="screenshots/staff-refund.png" alt="Refund working showing days used, fee used, amount paid and the refund due" width="480">

- [ ] Try 1 Dec 2026, which is in the future.

  **You should see:** a refund of **₹9,370**, and "This date is in the future, so this is a preview." There is no save button, because she has not actually left.

- [ ] Try 1 Jan 2031.

  **You should see:** "Enter a real date close to this student's term."

- [ ] Try 20 Jun 2026, which is before term starts.

  **You should see:** "The student left before term started, so no fee is used." The refund is the full **₹60,000**.

**Now do it for real with Mohit:**

- [ ] Click **Reminders** and search for `Mohit`.

  **You should see:** **Queued (3)**.

- [ ] Click his name, then **Work out refund**. Set the date to 25 Oct 2026 and click **Work out refund**.

  **You should see:** Days used **117 of 365**, Fee used **₹38,466**, Paid so far **₹40,000**, Refund due **₹1,534**, **Due by 4 Nov 2026 · Due in 2 days**.

- [ ] Click **Save refund and stop reminders**.

  **You should see:** "Refund saved. Reminders have stopped and no more payments are taken." The date box is gone, because the figures are now fixed.

**Check everything that should have changed:**

- [ ] Click **Back to ledger**.

  **You should see:** "Left on 25 Oct 2026." The **Record payment** button is gone, and the other button now says **View refund**.

- [ ] Click **Reminders** and search for `Mohit`.

  **You should see:** **Queued (0)**, and his waiting reminders say **Stopped: Student left**.

- [ ] Click **Dues**.

  **You should see:** **48 students**, a note that 1 student who left is left out, and these figures:

  | Figure | Amount |
  |---|---|
  | Billed | ₹57,00,000 |
  | Collected | ₹19,89,000 |
  | Outstanding | ₹37,11,000 |

  Collected went down because Mohit's account is closed, so his ₹40,000 is no longer in these totals. It still appears in the Tally export, because the money really was received.

- [ ] Sign out, then paste the "Mohit" address from your notepad into the address bar.

  **You should see:** "This student has left, so no more payments are taken here."

- [ ] Sign in as Mohit's parent with `9000000003`.

  **You should see:** **Refund for Mohit Gurjar, ₹1,534**, **Refund due by 4 Nov 2026**, **Left on 25 Oct 2026**. There are no dues and no pay button.

- [ ] Click **See receipts**.

  **You should see:** instalment 1 **Paid**, and instalments 2 and 3 **Closed**.

- [ ] Sign out.

---

## Mission 11: Check it on a phone screen

**Why it matters:** most parents will use a phone, so every page has to work on a small screen.

- [ ] Make your browser window as narrow as it will go. For a truer test, press `F12` and click the small phone icon at the top of the panel that opens.

- [ ] Sign in as any parent and open the home and instalments pages.

  **You should see:** everything fits, and the pay button is easy to tap.

- [ ] Sign in as staff with `9000000100` and open **Dues**, **Students**, **Reminders**, **Call tasks** and **Upload**.

  **You should see:** you never have to scroll sideways. Tables turn into stacked cards.

**You have finished.** Fill in the [scorecard](#scorecard) and send it to the team.

---

## Start over

This puts all the sample data back and removes your test payments, permissions, call task notes and refunds.

1. Sign out of the app.
2. Open a **second** terminal in the `coaching_institute` folder, and leave the app running in the first.
3. Run:

   ```
   npm run db:seed
   ```

4. Wait for `Replayed the term for 60 students.`, then begin again at Mission 1.

The language you chose is remembered, so the first screen may be sign-in and not the language choice. Use the link at the top right to switch language.

## When something goes wrong

| What you see | What to do |
|---|---|
| `password authentication failed` | The password in `.env` is wrong. Fix it and try again. If it contains symbols such as `@`, write them as web codes, for example `%40` for `@` |
| `connection refused` or `ECONNREFUSED` | PostgreSQL is not running, or uses a different port. Check it is running. If it uses another port, such as 5433, change `5432` in `.env` |
| The app stops at once with an error naming a setting | A line in `.env` is missing or empty. Repeat step 2 of the setup, then step 3 |
| The app starts on a port other than 3000 | Something else is using 3000. Close it and restart the app, or payments will fail |
| Every payment says "Payment failed" | The `APP_URL` line in `.env` must match your browser's address. Fix it and restart the app |
| No code appears on screen | Check `.env` says `DEMO_MODE=true`, then restart the app |
| "this number is not registered" for a number in this guide | Check for a typing mistake. If it is right, the sample data did not load, so run `npm run db:seed` |
| "Too many codes requested" | Wait 10 minutes, or [start over](#start-over) |
| The days overdue do not match this guide | Check `.env` says `APP_TODAY=2026-11-02`, then restart the app |
| The money figures do not match this guide | A mission was skipped or repeated. [Start over](#start-over) |
| You are signed in as the wrong person | One browser holds one person at a time. Sign out at the top right |

To restart the app, click its terminal, press `Ctrl + C`, and run `npm run dev` again.

## Words used in this app

| Word | Plain meaning |
|---|---|
| Instalment | One part of the yearly fee |
| Ledger | One student's full fee record |
| Net fee | The fee after any discount |
| Balance | What is still unpaid |
| Dues | Money owed to the institute |
| Ageing, or Overdue by age | Overdue money grouped by how late it is |
| Batch | A class group, such as JEE 2027 Morning |
| Test payment gateway | A pretend version of the service that takes card and UPI payments |
| Unmatched payment | Money that arrived but could not be placed on a fee |
| GST, CGST, SGST | Tax on the fee, split into a central share and a state share |
| Tally | Accounting software used by the centres |
| Template | A ready-made spreadsheet you fill in and upload |
| CSV | A simple spreadsheet file |
| Port | The number a program uses to talk on your computer, such as 3000 for this app |
| Pro-rata | Charged fairly by the number of days used |
| Call task | A reminder for staff to phone a family |
| False flag | The app raised a concern that turned out to be wrong |

## What this test does not cover

- **Real payments and text messages.** Both are pretend for now.
- **Moving an unmatched payment onto a fee.** Staff can see these payments but cannot apply them yet.
- **Whether the risk flag predicts real dropouts.** Its rules have only been tried on made-up data.

## Scorecard

Copy this into a message, mark each mission, and add a note for anything that did not match.

```
Fee Tracker test results
Tester:
Date:

Setup                                 Pass / Fail:
1  Sign in and permission             Pass / Fail:
2  Pay a fee                          Pass / Fail:
3  Other families                     Pass / Fail:
4  Who owes what                      Pass / Fail:
5  Look up a student                  Pass / Fail:
6  Counter payment                    Pass / Fail:
7  Reminders                          Pass / Fail:
8  Dropout risk                       Pass / Fail:
9  Upload                             Pass / Fail:
10 Refund                             Pass / Fail:
11 Phone screen                       Pass / Fail:

Problems (mission, step, what you expected, what you saw):
```
