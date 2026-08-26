import type { FieldSpec } from "@/lib/contacts/schema";

const CONTROL =
  "w-full rounded-md border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:bg-input";

/**
 * One labelled form control, driven by the field metadata in
 * `lib/contacts/schema.ts` so the form and its validation cannot drift apart.
 */
export default function Field({
  field,
  defaultValue,
  error,
}: {
  field: FieldSpec;
  defaultValue?: string;
  error?: string;
}) {
  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const borderClass = error
    ? "border-destructive focus:border-destructive"
    : "border-border focus:border-primary";

  const shared = {
    id,
    name: field.name,
    defaultValue,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: `${CONTROL} ${borderClass}`,
  };
  const text = {
    maxLength: field.maxLength,
    placeholder: field.placeholder,
    autoComplete: field.autoComplete,
  };

  return (
    <div className={field.wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {field.label}
        {field.required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : field.type === "select" ? null : (
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>

      {field.type === "textarea" ? (
        <textarea
          {...shared}
          {...text}
          rows={4}
          className={`${shared.className} resize-y`}
        />
      ) : field.type === "select" ? (
        <select {...shared}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...shared} {...text} type={field.type ?? "text"} />
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
