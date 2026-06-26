import type { InputHTMLAttributes } from "react";
import { useId } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

export function Field({ label, hint, error, ...input }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  
  return (
    <div className={`auth-field${error ? " auth-field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && !error && (
        <p className="auth-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="auth-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
