import React, { useState } from "react";

/**
 * The approved heights, in px. Exported so a call site names a step rather than
 * inventing one, the same way AVATAR_SIZES works.
 */
export const BUTTON_SIZES = [34, 40, 48];

const DEFAULT_SIZE = 40;

// Height is the only number a call site passes; everything that has to scale
// with it is derived here so two 40px buttons cannot end up differently padded.
const METRICS = {
  34: { paddingInline: 14, fontSize: 13, gap: 6 },
  40: { paddingInline: 18, fontSize: 15, gap: 8 },
  48: { paddingInline: 24, fontSize: 16, gap: 10 },
};

/*
 * Four variants, and the difference between them is only ever fill, border and
 * label colour — never size, weight or radius. A "secondary" button that is also
 * smaller and lighter stops being the same control.
 *
 * `secondary` is drawn for the paved ground, where the near-white keyline reads
 * against the plaza in both themes. Inside a notice — light paper in both
 * themes — a keyline on paper is invisible by design, and `ghost` is the button
 * for that surface.
 *
 * Hover on the filled variants is `brightness`, not a second colour: the accent
 * moves between Slate Day and Slate Night, so any hand-picked hover value would
 * be right in one theme and wrong in the other.
 */
const VARIANTS = {
  primary: {
    rest: {
      background: "var(--color-accent)",
      color: "var(--color-on-accent)",
      borderColor: "transparent",
    },
    hover: { filter: "brightness(1.07)" },
  },
  secondary: {
    rest: {
      background: "transparent",
      color: "var(--color-ink)",
      borderColor: "var(--color-keyline)",
    },
    hover: { background: "var(--color-chip)" },
  },
  ghost: {
    rest: {
      background: "transparent",
      color: "var(--color-ink)",
      borderColor: "transparent",
    },
    hover: { background: "var(--color-chip)" },
  },
  danger: {
    rest: {
      background: "var(--color-like)",
      color: "var(--color-on-like)",
      borderColor: "transparent",
    },
    hover: { filter: "brightness(1.07)" },
  },
};

/*
 * Inline styles, not utility classes. Tailwind's utilities land in
 * @layer utilities and the 877-line unlayered index.css outranks the whole
 * layer, so a `bg-accent rounded-pill` button would render as whatever
 * index.css says a <button> is until that file is deleted. See the header of
 * theme.css. The cost is that a pseudo-class cannot be expressed, which is why
 * hover and focus are React state below.
 *
 * The border is always 2px and only its colour changes, so switching variant or
 * focusing never moves the label by a pixel.
 */
const BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  borderStyle: "solid",
  borderWidth: 2,
  borderRadius: "var(--radius-pill)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background 120ms ease, filter 120ms ease",
};

const DISABLED = { opacity: 0.45, cursor: "not-allowed", filter: "none" };

// An outline rather than a box-shadow ring, so it needs no translucent variant
// of the accent — there is no way to add alpha to a var() without color-mix, and
// the outline reads on every one of the four fills as it is.
const FOCUS_RING = { outline: "2px solid var(--color-accent)", outlineOffset: 2 };

/**
 * A button.
 *
 * Props:
 *   variant   — "primary" (default) | "secondary" | "ghost" | "danger"
 *   size      — px height, one of BUTTON_SIZES (default 40)
 *   type      — "button" (default) | "submit" | "reset". Defaulted deliberately:
 *               a bare <button> inside a <form> submits it, which is how
 *               AddPost's Cancel button has to say type="button" by hand today.
 *   disabled  — the real attribute, so the click is blocked by the browser and
 *               not by a handler that forgets
 *   onClick / className / style — passed through
 *   ...rest   — anything else lands on the <button>: aria-label, title, form
 */
const Button = ({
  variant = "primary",
  size = DEFAULT_SIZE,
  type = "button",
  disabled = false,
  onClick,
  className = "",
  style,
  children,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);
  const [ringVisible, setRingVisible] = useState(false);

  const skin = VARIANTS[variant] ?? VARIANTS.primary;
  const metrics = METRICS[size] ?? METRICS[DEFAULT_SIZE];

  // :focus-visible is what separates a keyboard focus from the focus a mouse
  // click leaves behind, and an inline style cannot hold a pseudo-class — so ask
  // the element whether it matches one. A ring on every mouse click is the
  // reason people reach for outline:none and break keyboard users instead.
  const showRing = (event) => setRingVisible(event.target.matches(":focus-visible"));

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={showRing}
      onBlur={() => setRingVisible(false)}
      style={{
        ...BASE,
        ...metrics,
        height: size,
        ...skin.rest,
        ...(hovered && !disabled ? skin.hover : null),
        ...(disabled ? DISABLED : null),
        ...(ringVisible ? FOCUS_RING : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export default Button;
