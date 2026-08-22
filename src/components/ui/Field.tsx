import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function inputClasses(invalid?: boolean) {
  return `w-full rounded-control border px-3 py-2 text-sm text-ink placeholder:text-ink-subtle disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring ${
    invalid ? "border-danger-line bg-danger-soft" : "border-line-strong bg-surface"
  }`;
}

export function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input({
  invalid,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`${inputClasses(invalid)} ${className}`} {...props} />;
}

export function Select({
  invalid,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={`${inputClasses(invalid)} ${className}`} {...props} />;
}

export function Textarea({
  invalid,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={`${inputClasses(invalid)} ${className}`} {...props} />;
}
