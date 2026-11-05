import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/button-styles";
import { SubmitButton } from "@/components/submit-button";
import { balanceOf } from "@/domain/instalments";
import { formatInr } from "@/domain/money";
import { messages } from "@/i18n";
import { env } from "@/lib/env";
import { instalmentById } from "@/lib/ledger";
import { getLocale } from "@/lib/locale";
import { instalmentIdFromToken } from "@/lib/pay-links";
import { hasLeft } from "@/lib/students";
import { payAtGateway } from "./actions";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ failed?: string }>;
};

export default async function GatewayPage({ params, searchParams }: Props) {
  if (!env.DEMO_MODE) notFound();

  const { token } = await params;
  const { failed } = await searchParams;
  const t = messages(await getLocale());

  const instalmentId = instalmentIdFromToken(token);
  const instalment = instalmentId ? await instalmentById(instalmentId) : null;
  const balance = instalment ? balanceOf(instalment) : 0;
  const studentLeft = instalment ? await hasLeft(instalment.studentId) : false;

  const shell = "mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 px-4 py-6";

  if (!instalment || balance === 0 || studentLeft) {
    return (
      <main className={shell}>
        <h1 className="text-xl leading-7 font-medium">{t.gateway.title}</h1>
        <p>
          {!instalment
            ? t.gateway.invalidLink
            : studentLeft
              ? t.gateway.studentLeft
              : t.gateway.alreadyPaid}
        </p>
        <Link href="/parent" className={buttonStyles.primary}>
          {t.gateway.goToDues}
        </Link>
      </main>
    );
  }

  const attempt = randomUUID();
  const hidden = (outcome: string) => (
    <>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="attempt" value={attempt} />
      <input type="hidden" name="outcome" value={outcome} />
    </>
  );
  const others = [
    { outcome: "part", label: t.gateway.outcomePart(formatInr(Math.max(100, Math.round(balance / 200) * 100))) },
    { outcome: "over", label: t.gateway.outcomeOver(formatInr(balance + 100_000)) },
    { outcome: "unknown", label: t.gateway.outcomeUnknown },
    { outcome: "fail", label: t.gateway.outcomeFail },
  ];

  return (
    <main className={shell}>
      <div>
        <h1 className="text-xl leading-7 font-medium">{t.gateway.title}</h1>
        <p className="mt-1 text-muted">{t.gateway.testMode}</p>
      </div>

      {failed && (
        <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
          {t.gateway.failed}
        </p>
      )}

      <section>
        <p>{t.gateway.paying(t.institute, instalment.sequence)}</p>
        <p className="mt-2 text-amount font-medium">{formatInr(balance)}</p>
      </section>

      <form action={payAtGateway}>
        {hidden("success")}
        <SubmitButton label={t.gateway.pay(formatInr(balance))} pendingLabel={t.gateway.paying2} />
      </form>

      <section className="mt-auto rounded-md border border-divider bg-surface p-4">
        <h2 className="font-medium">{t.gateway.outcomesTitle}</h2>
        <div className="mt-3 flex flex-col gap-2">
          {others.map((item) => (
            <form key={item.outcome} action={payAtGateway}>
              {hidden(item.outcome)}
              <SubmitButton label={item.label} pendingLabel={t.gateway.paying2} variant="secondary" />
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
