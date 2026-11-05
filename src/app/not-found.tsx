import Link from "next/link";
import { messages } from "@/i18n";
import { getLocale } from "@/lib/locale";

export default async function NotFound() {
  const t = messages(await getLocale());

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-medium">{t.errors.notFoundTitle}</h1>
      <p className="text-muted">{t.errors.notFoundBody}</p>
      <Link href="/" className="font-medium underline underline-offset-4">
        {t.errors.goHome}
      </Link>
    </main>
  );
}
