import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-sm ring-1 ring-inset ring-line " +
  "placeholder:text-stone-500 focus:ring-2 focus:ring-inset focus:ring-brand-500 focus:outline-none " +
  "disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:ring-red-600 min-h-11";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  required?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint + error, wired together for assistive technology. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorText = Array.isArray(error) ? error[0] : error;
  const errorId = errorText ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="text-red-700" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(errorText) })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "pr-9", className)} {...props}>
      {children}
    </select>
  );
}

/** Text field convenience wrapper. */
export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: Omit<ComponentProps<"input">, "id"> & { label: ReactNode; hint?: ReactNode; error?: string | string[] }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...props} />
      )}
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  ...props
}: Omit<ComponentProps<"textarea">, "id"> & { label: ReactNode; hint?: ReactNode; error?: string | string[] }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <Textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...props} />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: Omit<ComponentProps<"select">, "id"> & { label: ReactNode; hint?: ReactNode; error?: string | string[] }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...props}>
          {children}
        </Select>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-2 -m-2 hover:bg-brand-50/60", className)}>
      <input
        type="checkbox"
        className="size-6 shrink-0 rounded border-line accent-brand-700 focus-visible:outline-3 focus-visible:outline-brand-500"
        {...props}
      />
      <span className="pt-0.5 text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Fieldset({ legend, hint, children, className }: { legend: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("space-y-3", className)}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? <p className="-mt-1 text-sm text-muted">{hint}</p> : null}
      {children}
    </fieldset>
  );
}
