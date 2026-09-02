import React from "react";

/*
 * `currentColor` at low opacity, rather than a colour of its own.
 *
 * A skeleton has to read on three surfaces that do not share an ink: paper
 * inside a notice (dark text), the paved ground in Slate Day (dark text) and the
 * paved ground in Slate Night (near-white text). Any fixed fill is invisible on
 * one of them, and --color-chip — the obvious candidate — is the same lightness
 * as paper in Slate Day, so a chip-filled bar on a notice disappears. Borrowing
 * the surface's own text colour and knocking it back solves all three at once
 * and needs no prop saying where the skeleton is.
 *
 * Static, not pulsing: an inline style cannot hold @keyframes, and the whole
 * component layer is inline styles until index.css is deleted (see theme.css).
 * The shimmer belongs to the stylesheet that replaces it.
 */
const BASE = {
  display: "block",
  backgroundColor: "currentColor",
  opacity: 0.12,
  flexShrink: 0,
};

const DEFAULT_DIAMETER = 40;
const DEFAULT_BAR_HEIGHT = 12;

/**
 * The shape of something that has not loaded yet.
 *
 * Props:
 *   variant   — "bar" (default) | "circle"
 *   width     — CSS length or px number. A bar defaults to filling its parent;
 *               a circle uses this as its diameter (default 40, matching the
 *               default Avatar)
 *   height    — CSS length or px number; a bar defaults to 12
 *   className / style — passed through
 *   ...rest   — anything else lands on the element
 *
 * Always aria-hidden. A screen reader announcing four grey rectangles is worse
 * than silence — the loading state belongs on the region, as aria-busy.
 */
const Skeleton = ({ variant = "bar", width, height, className = "", style, ...rest }) => {
  const shape =
    variant === "circle"
      ? {
          width: width ?? DEFAULT_DIAMETER,
          height: height ?? width ?? DEFAULT_DIAMETER,
          borderRadius: "50%",
        }
      : {
          width: width ?? "100%",
          height: height ?? DEFAULT_BAR_HEIGHT,
          borderRadius: "var(--radius-pill)",
        };

  return (
    <span
      {...rest}
      aria-hidden="true"
      className={className}
      style={{ ...BASE, ...shape, ...style }}
    />
  );
};

export default Skeleton;
