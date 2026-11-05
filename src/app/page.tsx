import { messages } from "@/i18n";

export default function Home() {
  const en = messages("en");
  const hi = messages("hi");

  return (
    <main className="mx-auto max-w-[480px] px-4 py-12">
      <h1 className="text-[32px] leading-10 font-medium">{en.appName}</h1>
      <p className="mt-2 text-muted">{en.tagline}</p>
      <p className="mt-1 text-muted" lang="hi">
        {hi.tagline}
      </p>
    </main>
  );
}
