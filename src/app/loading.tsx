export default function Loading() {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-12" aria-busy="true">
      <div className="h-5 w-32 rounded-sm bg-highlight" />
      <div className="mt-6 h-16 w-56 rounded-sm bg-highlight" />
      <div className="mt-4 h-5 w-48 rounded-sm bg-highlight" />
    </main>
  );
}
