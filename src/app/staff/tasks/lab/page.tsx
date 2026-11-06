import Link from "next/link";
import { buttonStyles, rowLink } from "@/components/button-styles";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { DEFAULT_RULES, RULE_VERSION, type RiskRules } from "@/domain/risk";
import {
  compareReplays,
  falseFlagsByReason,
  readRules,
  replayRule,
  suggestRules,
  summariseReplay,
} from "@/domain/risk-lab";
import { formatDate, messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getLocale } from "@/lib/locale";
import { allReviews, labStudents } from "@/lib/risk-lab";

type Query = Partial<Record<"am" | "as" | "tm" | "ts" | "w" | "h" | "learn", string>>;

const rulesHref = (rules: RiskRules) =>
  `/staff/tasks/lab?am=${rules.attendanceDrop.mild}&as=${rules.attendanceDrop.strong}&tm=${rules.testDrop.mild}&ts=${rules.testDrop.strong}&w=${rules.watchPoints}&h=${rules.highPoints}`;

export default async function RiskLabPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const locale = await getLocale();
  const t = messages(locale);
  const k = t.staff.lab;
  const date = today();

  const { rules, invalid } = readRules(query);
  const [{ students, termStart }, reviews] = await Promise.all([labStudents(), allReviews()]);

  const live = replayRule(students, termStart, date);
  const trial = rules === DEFAULT_RULES ? live : replayRule(students, termStart, date, rules);
  const summary = summariseReplay(trial);
  const change = compareReplays(live, trial);
  const byReason = falseFlagsByReason(reviews);
  const changed = JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);

  const falseFlagCodes = reviews.filter((r) => r.status === "false_flag").map((r) => r.code);
  const learned = query.learn ? suggestRules(students, termStart, date, falseFlagCodes) : null;

  const fields = [
    { name: "am", label: k.attendanceMild, value: rules.attendanceDrop.mild },
    { name: "as", label: k.attendanceStrong, value: rules.attendanceDrop.strong },
    { name: "tm", label: k.testMild, value: rules.testDrop.mild },
    { name: "ts", label: k.testStrong, value: rules.testDrop.strong },
    { name: "w", label: k.watch, value: rules.watchPoints },
    { name: "h", label: k.high, value: rules.highPoints },
  ];

  const figures = [
    { label: k.caught, value: k.caughtValue(summary.caught, summary.left) },
    { label: k.lead, value: k.leadValue(summary.averageWarning) },
    { label: k.open, value: summary.open },
    {
      label: k.falseFlags,
      value: reviews.filter((flag) => flag.status === "false_flag").length,
    },
  ];

  return (
    <>
      <div className="max-w-[640px]">
        <Link
          href="/staff/tasks"
          className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
        >
          {k.back}
        </Link>
        <h1 className="text-[32px] leading-10 font-medium">{k.title}</h1>
        <p className="mt-2 text-muted">{k.intro}</p>
        <p className="mt-2 rounded-md bg-highlight px-4 py-3">{k.caveat}</p>
      </div>

      <form className="flex flex-col gap-4 rounded-md border border-divider bg-surface p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map((field) => (
            <TextField
              key={field.name}
              name={field.name}
              label={field.label}
              type="number"
              defaultValue={String(field.value)}
            />
          ))}
        </div>
        <p className="text-sm text-muted">
          {k.guard} {k.version(RULE_VERSION)}
        </p>
        {invalid && (
          <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
            {k.invalid}
          </p>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:w-72">
            <button type="submit" className={buttonStyles.secondary}>
              {k.run}
            </button>
          </div>
          {changed && (
            <Link href="/staff/tasks/lab" className="min-h-12 py-3 font-medium underline underline-offset-4">
              {k.reset}
            </Link>
          )}
        </div>
      </form>

      {!learned && (
        <Link href="/staff/tasks/lab?learn=1" className="self-start py-3 font-medium underline underline-offset-4">
          {k.learn}
        </Link>
      )}
      {learned && (
        <div className="flex flex-col gap-1 rounded-md bg-highlight px-4 py-3">
          {learned.kind === "too-little-evidence" && <p>{k.learnThin(learned.evidence)}</p>}
          {learned.kind === "keep-live-rule" && <p>{k.learnKeep}</p>}
          {learned.kind === "better" && (
            <>
              <p>
                {k.learnBetter(
                  summariseReplay(learned.live).caught,
                  summariseReplay(learned.trial).caught,
                  summariseReplay(learned.live).open,
                  summariseReplay(learned.trial).open,
                )}
              </p>
              <Link href={rulesHref(learned.rules)} className="font-medium underline underline-offset-4">
                {k.learnTry}
              </Link>
            </>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-divider bg-surface p-6 lg:grid-cols-4">
        {figures.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="mt-1 text-2xl leading-8 font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>

      {changed && (
        <div className="flex flex-col gap-1 rounded-md bg-highlight px-4 py-3">
          {change.added.length === 0 && change.dropped.length === 0 && <p>{k.same}</p>}
          {change.added.length > 0 && <p>{k.added(change.added.join(", "))}</p>}
          {change.dropped.length > 0 && <p>{k.dropped(change.dropped.join(", "))}</p>}
        </div>
      )}

      {trial.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">{k.none}</p>
      ) : (
        <DataTable
          rows={trial}
          rowKey={(row) => row.code}
          columns={[
            {
              header: k.student,
              cell: (row) => (
                <Link href={`/staff/students?q=${row.code}`} className={rowLink}>
                  {row.name}
                </Link>
              ),
            },
            {
              header: k.firstFlag,
              cell: (row) => (row.firstFlag ? formatDate(row.firstFlag, locale) : "-"),
            },
            { header: k.left, cell: (row) => (row.exitDate ? formatDate(row.exitDate, locale) : "-") },
            {
              header: k.warning,
              align: "right",
              cell: (row) => (row.warningDays === null ? "-" : k.warningValue(row.warningDays)),
            },
            { header: k.outcome, cell: (row) => k.outcomes[row.outcome] },
          ]}
        />
      )}

      <section className="flex flex-col gap-3 pb-8">
        <h2 className="text-xl leading-7 font-medium">{k.byReason}</h2>
        {byReason.length === 0 ? (
          <p className="rounded-md border border-divider bg-surface p-6 text-muted">{k.noReviews}</p>
        ) : (
          <DataTable
            rows={byReason}
            rowKey={(row) => row.kind}
            columns={[
              { header: k.reason, cell: (row) => k.reasons[row.kind] },
              { header: k.reviewed, align: "right", cell: (row) => row.reviewed },
              { header: k.markedFalse, align: "right", cell: (row) => row.falseFlags },
            ]}
          />
        )}
      </section>
    </>
  );
}
