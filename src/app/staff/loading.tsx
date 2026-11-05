export default function StaffLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-10 w-48 rounded-sm bg-highlight" />
      <div className="h-12 w-full rounded-sm bg-highlight" />
      <div className="h-64 w-full rounded-md bg-highlight" />
    </div>
  );
}
