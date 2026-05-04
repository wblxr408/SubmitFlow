import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}

export function Select({ className, label, options, error, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'h-9 rounded border border-border bg-bg-card px-3 text-sm text-text-primary focus:border-border-strong focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-accent-red',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-accent-red">{error}</p>}
    </div>
  );
}
