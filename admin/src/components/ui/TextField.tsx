"use client";

import Image from "next/image";
import { forwardRef, useId, useState, type ReactNode } from "react";
import { Field } from "./Field";
import { Input, Select, Textarea } from "./Input";

/** Label/hint/error options shared by every field. */
interface FieldOptions {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  /** Right side of the label row (e.g. a character counter). */
  aside?: ReactNode;
  className?: string;
}

type TextFieldProps = FieldOptions &
  Omit<React.ComponentProps<typeof Input>, "id" | "aria-invalid"> & { id?: string };

/**
 * Figma "Field / …": label + 48px input + hint/error, wired for accessibility
 * (label `for`, aria-invalid, aria-describedby). `type="password"` gets the
 * Figma eye button to show/hide the value. Use with react-hook-form's
 * `register()` — the ref goes to the <input>.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, required, hint, error, aside, className, id, type, trailing, ...inputProps },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <Field
      label={label}
      htmlFor={inputId}
      required={required}
      hint={hint}
      error={error}
      aside={aside}
      className={className}
    >
      <Input
        ref={ref}
        id={inputId}
        type={isPassword && revealed ? "text" : type}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${inputId}-note` : undefined}
        trailing={
          isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              className="-m-1 grid place-items-center rounded-md p-1 hover:bg-black/5"
            >
              <Image
                src="/images/icons/eye.svg"
                alt=""
                aria-hidden
                width={18}
                height={18}
                unoptimized
                className={revealed ? "opacity-100" : "opacity-80"}
              />
            </button>
          ) : (
            trailing
          )
        }
        {...inputProps}
      />
      <span id={`${inputId}-note`} className="sr-only">
        {error ?? (typeof hint === "string" ? hint : "")}
      </span>
    </Field>
  );
});

type SelectFieldProps = FieldOptions &
  Omit<React.ComponentProps<typeof Select>, "id" | "aria-invalid"> & { id?: string };

/** Figma select field ("Field / Ranking basis"): same box with the chevron. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, required, hint, error, aside, className, id, ...selectProps },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field
      label={label}
      htmlFor={selectId}
      required={required}
      hint={hint}
      error={error}
      aside={aside}
      className={className}
    >
      <Select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        {...selectProps}
      />
    </Field>
  );
});

type TextAreaFieldProps = FieldOptions &
  Omit<React.ComponentProps<typeof Textarea>, "id" | "aria-invalid"> & { id?: string };

/** Figma multi-line field ("Field / Offer description"). */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { label, required, hint, error, aside, className, id, ...areaProps },
    ref,
  ) {
    const autoId = useId();
    const areaId = id ?? autoId;
    return (
      <Field
        label={label}
        htmlFor={areaId}
        required={required}
        hint={hint}
        error={error}
        aside={aside}
        className={className}
      >
        <Textarea
          ref={ref}
          id={areaId}
          required={required}
          aria-invalid={Boolean(error)}
          {...areaProps}
        />
      </Field>
    );
  },
);
