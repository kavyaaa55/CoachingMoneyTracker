---
# gstack: design-md-format=spec
name: Fee Tracker
description: A calm, trustworthy fee portal. Plain type, one quiet blue, open space, and nothing on screen without a purpose.
colors:
  primary: "#1F5673"
  primary-hover: "#184560"
  on-primary: "#FFFFFF"
  ink: "#1F2F3A"
  muted: "#546672"
  canvas: "#F4F7F8"
  surface: "#FFFFFF"
  highlight: "#E3EDF1"
  divider: "#D5DEE3"
  control: "#7C8E99"
  paid: "#256B57"
  paid-tint: "#E6F2EE"
  overdue: "#94501A"
  overdue-tint: "#FBF1E6"
  error: "#A63A2E"
  error-tint: "#FBECEA"
typography:
  amount:
    fontFamily: Noto Sans
    fontSize: 52px
    fontWeight: 500
    lineHeight: 64px
  heading-lg:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: 500
    lineHeight: 40px
  heading-md:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 28px
  body:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: Noto Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
rounded:
  sm: 6px
  md: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input:
    borderColor: "{colors.control}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.divider}"
    rounded: "{rounded.md}"
  chip-paid:
    backgroundColor: "{colors.paid-tint}"
    textColor: "{colors.paid}"
    rounded: "{rounded.sm}"
  chip-overdue:
    backgroundColor: "{colors.overdue-tint}"
    textColor: "{colors.overdue}"
    rounded: "{rounded.sm}"
  chip-neutral:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
---

# Fee Tracker

## Overview

**Creative North Star:** Trust and calm. A parent understands their dues in five seconds and never feels chased.

**Product context:** A fee portal for Company A, a Jaipur coaching institute with 4 centres and 2,600 students. Parents use low-end phones, often in Hindi. Accounts staff work on desktops.

**Mode per surface:**
- Parent portal: Operate. One task per screen, phone first.
- Staff workspace: Operate. Dense tables, desktop first, still usable on a phone.
- Receipt and refund policy: Read. Printable, plain.

**Key characteristics:**
- The amount is the largest thing on the screen.
- One blue carries every action.
- Late fees are stated as facts, in amber. Red means something failed.
- Hindi and English get the same layout and the same care.

## Colors

**Strategy:** Restrained. One blue, cool neutrals, and three status colours.

**Light or dark:** Light only. Parents check dues in daylight on cheap screens, and staff work in lit offices. A dark theme would double the checking for no user need.

- `primary` is the only colour for actions. If it is blue, it can be pressed.
- `overdue` is amber on purpose. An overdue fee is a fact to state, not an emergency.
- `error` is for real failures only, such as a declined payment or a failed upload.
- `muted` is the lightest allowed text colour. `divider` is for lines only, never text.
- Status never relies on colour alone. It always has a word.

Measured contrast on white: ink 13.8:1, primary 8.0:1, error 6.4:1, paid 6.3:1, overdue 6.1:1, muted 6.0:1, control border 3.4:1.

## Typography

Noto Sans is the only family. It has Latin, Devanagari and the ₹ sign, and its Latin digits are all one width, so ledger columns line up without extra settings. It is also the Hindi typeface most Android phones already use, so it looks familiar to parents.

Rejected after testing the font files: Inter (no Devanagari), Hind and Martel (digits differ in width), Palanquin (no ₹ sign).

- Load through `next/font/google` with the `latin` and `devanagari` subsets. Weights 400 and 500 only.
- Maximum weight is 500. Calm comes from size and space, not bold type.
- Money uses Indian grouping (`₹1,20,000`) through `formatInr`. Digits stay Latin in Hindi, as Indian bills and bank apps do.
- Devanagari needs room: keep body line height at 1.5 or more, and never use all caps or letter spacing on labels.

## Layout

**Parent portal:** single column, 480px maximum, 16px side margins. No sidebar, no dashboard, no footer. Designed at 360px first.

**Staff workspace:** 240px left sidebar with a fluid main area up to 1180px. Below 768px the sidebar becomes a top menu and tables become stacked rows.

**Density:** table rows 48px, cell padding 16px. All touch targets at least 48px, and the parent pay button 56px.

## Elevation & Depth

Flat. Depth comes from white surfaces on the canvas and a 1px `divider` border. No shadows anywhere. Dialogs sit on a wash of `ink` at 40% opacity.

## Shapes

Cards, inputs and dialogs use `md`. Buttons and chips use `sm`. No pill shapes and no circular buttons.

## Components

Every component needs its loading, empty and error state before it counts as done. Focus uses a 2px `primary` outline with a 2px offset, never removed.

- **Button:** primary is solid, secondary is white with a `control` border. Destructive is white with `error` text and always opens a confirm step. Disabled uses `divider` fill and `muted` text.
- **Status chip:** `Paid`, `Part paid, 23 days overdue`, `Due in 13 days`. Always a full phrase.
- **Amount block:** name line, amount, one status line. Used on parent home and the refund result.
- **Table:** header on `canvas`, amounts right aligned, rows divided by `divider`.
- **Empty state:** one sentence saying what will appear here, and one action if there is one. No illustrations.
- **Loading:** grey blocks in the real layout. No spinner on full pages.
- **Error:** says what happened and what to do next, in the parent's language.

## Do's and Don'ts

- Do: keep parent home to name, amount, status line, pay button and one link.
- Do: check every screen at 360px, in Hindi and in English.
- Do: show how a refund was calculated, line by line.
- Do: pull all user-facing text from the language files.
- Don't: use red for overdue fees, or warning icons on parent screens.
- Don't: add shadows, gradients, coloured side borders, icon tiles or cards inside cards.
- Don't: show invented metrics such as delivery rates or uptime. Only real data, or an honest empty state.
- Don't: show dropout risk as a score like 72/100. Use a band with plain reasons, and only to staff.

## Motion

- **Approach:** minimal-functional. Only state changes move.
- **Easing:** ease-out for enter, ease-in for exit.
- **Duration:** 150ms. Respect `prefers-reduced-motion`.
- **The one authored moment:** none. After payment the screen simply changes to the paid state, which is the reassurance.

## Screen Plan

The mockups in `docs/mockups` are layout reference only. Their colours, font and sample numbers are out of date. This plan decides what each one becomes.

**Problems found across all 31 mockups**

| Problem | Fix |
|---|---|
| No Hindi anywhere, and Inter cannot render it | Noto Sans, language files, language choice before OTP |
| Designed at desktop width, including parent screens | Rebuild parent screens at 360px |
| Ishita's numbers disagree: ₹99,000 and ₹45,000 paid, ₹1,14,000 and ₹1,30,000 plans | One source: the seed data, ₹1,20,000 plan and ₹45,000 paid |
| Claims not in the brief: "Rajasthan Coaching Regulations", "Legal notice pending", ₹15,000 registration fee | Remove. Cite only the Ministry of Education 2024 guidelines |
| Wrong facts on sign in: 2,480 students, 3 branches | Brief facts only: 2,600 students, 4 centres |
| Invented metrics: 99.8% delivery, "Ledger Nodes Online", "AWS-West" | Remove |
| Drop shadows and coloured side borders | Remove. Flat surfaces only |
| Reminders mockup fell back to a serif font | Fixed by the shared layout |

**Core build, 8 screens**

| Screen | Base mockup | Change |
|---|---|---|
| Sign in with OTP | 1.2, 1.3 | One column, no marketing panel. Language choice first |
| Parent consent | 1.4 | Plain wording, shown once, before any student data |
| Parent home | 2.1, 2.1b | Amount block and pay button only. Instalments behind one link. When nothing is overdue, show the next due date |
| Pay and receipt | 2.2, 2.3, 3.2 | One confirm step, test-mode label, printable GST receipt |
| Dues dashboard | 4.1, 4.2 | Keep ageing and by-batch table. Remove progress bars and invented notes. Tally export stays |
| Student ledger | 4.3, 5.1, 5.2 | Keep schedule and payments. Risk becomes a band with reasons |
| Refund calculator | 6.1, 6.2, 6.4 | One column of working lines, then the result and the 10-day deadline |
| Reminders and tasks | 7.1, 7.2, 7.3 | Show sent, stopped on payment and queued. False-flag action on tasks |

**Optional depth, built after the core worked**

| Screen | Base mockup | Change |
|---|---|---|
| Parent attendance and scores | 3.3, 3.4 | One page, not two. Plain figures, with no trend or risk wording. Reached from the instalments page, so parent home keeps its one link |
| Bulk upload | 8.1 | One column of choices, then a preview before saving. Errors listed by line, and nothing saved until the whole file passes |

**Level-up, built on the same system**

| Screen | Base mockup | Change |
|---|---|---|
| Close the books | 8.2 | Month-end checks first, then the queue. A suggestion always states its reason |
| Audit log | 8.3 | Read only, plain table |
| Refund desk | None | Same figures row and table as Dues, soonest deadline first |
| Director scoreboard | None | Tables and figures only, no charts |
| Risk lab | None | A plain form that writes nothing, with the caveat stated first |
| Reviewer console | None | Demo mode only, so no parent or real user ever sees it |

**Dropped:** 1.1 design sheet (this file replaces it), and 1.5 and 1.6 as separate screens (they become the two shared layouts).

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-05 | Moved from Academic Ledger to a calm blue system | Client asked for trust and calm; cream, navy and brick red read as stern |
| 2026-11-05 | Noto Sans replaces Inter | Hindi is required and Inter has no Devanagari; Noto has one-width digits and is familiar on Android |
| 2026-11-05 | Overdue is amber, red is failures only | Parents should not feel chased |
| 2026-11-05 | Parent home is not a dashboard | The brief's five-second test |
| 2026-11-05 | Risk shown as a band, not a score | The flag is uncertain and should look uncertain |
| 2026-11-05 | Parent attendance and scores sit behind the instalments page | Parent home keeps one link and passes the five-second test |
| 2026-11-06 | New staff screens reuse the Dues figures row and DataTable | Five new screens, no new visual language |
| 2026-11-06 | Scoreboard uses tables, not charts | Progress bars were already removed, and the client asked for restraint |
| 2026-11-06 | AI output sits inside existing cards, on `highlight`, always labelled | No new screens or components, and staff must know what the model wrote |
