import React, { forwardRef, useId, useState } from "react";

const ROOT = { display: "block", fontFamily: "var(--font-body)" };

const LABEL = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.01em",
  // Inherited, not stated: a field sits on the paved ground on Signin and on
  // paper inside a notice, and those two surfaces want different ink. Whatever
  // the surface set is already correct.
  color: "inherit",
};

/*
 * The control is always paper, in both themes and on both surfaces. An input is
 * a place to write, and paper/paper-ink is the one pair in the palette that does
 * not flip at night — a field that inverted with the theme while the notice
 * around it did not would be the only white-on-white surface in the app.
 */
const CONTROL = {
  boxSizing: "border-box",
  width: "100%",
  padding: "9px 12px",
  borderStyle: "solid",
  // Constant width, and only the colour changes for focus and error, so neither
  // state nudges the text by a pixel.
  borderWidth: 2,
  borderRadius: "var(--radius-control)",
  backgroundColor: "var(--color-paper)",
  color: "var(--color-paper-ink)",
  fontFamily: "inherit",
  fontSize: 15,
  lineHeight: 1.4,
  outlineOffset: 2,
};

const ERROR = {
  margin: "6px 0 0",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-like)",
};

/**
 * A labelled form control: label, input, and an error message when there is one.
 *
 * The label is genuinely associated with the input. Every form in the app today
 * writes `htmlFor` and `id` as matching literal strings — Signin has
 * "email-address" typed twice — which works exactly until the same field appears
 * twice on one page and both labels start pointing at the first input. `useId`
 * generates a pair that is unique per instance, and an explicit `id` still wins
 * for the cases where something outside has to address the control.
 *
 * Props:
 *   label     — the label text (required for it to be a Field at all)
 *   id        — the control's id; generated when omitted
 *   error     — message string. Truthy also turns the border and aria-invalid on
 *   as        — "input" (default) | "textarea"
 *   className / style — passed through to the wrapper
 *   ref       — forwarded to the control, for the uncontrolled forms that exist
 *               today and for focus management
 *   ...rest   — everything else lands on the control: type, value, onChange,
 *               placeholder, maxLength, required, disabled
 */
const Field = forwardRef(function Field(
  {
    label,
    id,
    error = "",
    as = "input",
    className = "",
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const generated = useId();

  const controlId = id ?? `${generated}-control`;
  const errorId = `${generated}-error`;
  const Control = as;
  const isTextarea = as === "textarea";

  // No :focus-visible test here, unlike Button. A focused text input has a
  // caret in it and must look focused however the focus arrived — the reason to
  // suppress a ring on mouse click is that a clicked button looks pressed
  // already, and an input does not.
  const handleFocus = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const borderColor = error
    ? "var(--color-like)"
    : focused
      ? "var(--color-accent)"
      : "var(--color-paper-muted)";

  return (
    <div className={className} style={{ ...ROOT, ...style }}>
      <label htmlFor={controlId} style={LABEL}>
        {label}
      </label>

      <Control
        {...rest}
        ref={ref}
        id={controlId}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-invalid={error ? "true" : undefined}
        // Without this the message is visible but unannounced: a screen reader
        // moving through the form reads the label and the value and nothing
        // about why the field is red.
        aria-describedby={error ? errorId : undefined}
        style={{
          ...CONTROL,
          borderColor,
          outline: focused ? "2px solid var(--color-accent)" : "none",
          minHeight: isTextarea ? 96 : 40,
          resize: isTextarea ? "vertical" : undefined,
        }}
      />

      {error ? (
        // role="alert" because the node appears after a failed submit rather
        // than being present all along, so it has to interrupt to be heard.
        <p id={errorId} role="alert" style={ERROR}>
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default Field;
