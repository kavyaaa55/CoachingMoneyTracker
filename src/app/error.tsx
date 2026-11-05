"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-medium">Something went wrong</h1>
      <p lang="hi" className="text-xl font-medium">
        कुछ ग़लत हो गया
      </p>
      <p className="text-muted">Please try again. / कृपया फिर कोशिश करें।</p>
      <button
        type="button"
        onClick={reset}
        className="h-12 rounded-sm bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
      >
        Try again / फिर कोशिश करें
      </button>
    </main>
  );
}
