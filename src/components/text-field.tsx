type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  name: string;
};

export function TextField({ label, hint, name, ...input }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        required
        className="h-12 w-full rounded-md border border-control bg-surface px-4 text-lg"
        {...input}
      />
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
