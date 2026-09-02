import React from "react";
import { avatarColor } from "../../lib/avatarColor";

/*
 * The keyline is the gap between the two radii, so it is not a free number:
 * --radius-keyline-wrapper (32) minus --radius-notice (26) is 6px, and any other
 * padding leaves the outer curve and the inner curve non-concentric — the corner
 * reads as a mistake rather than as a die-cut.
 */
const KEYLINE = 6;

const WRAPPER = {
  display: "block",
  boxSizing: "border-box",
  padding: KEYLINE,
  background: "var(--color-keyline)",
  borderRadius: "var(--radius-keyline-wrapper)",
  boxShadow: "var(--shadow-notice)",
};

const SURFACE = {
  boxSizing: "border-box",
  borderRadius: "var(--radius-notice)",
  fontFamily: "var(--font-body)",
  // Not --color-ink. A notice is light paper in BOTH themes, so its text is dark
  // in both; --color-ink flips to near-white at night and would print white on
  // white. Set here so everything inside inherits it and no child has to know.
  color: "var(--color-paper-ink)",
};

/**
 * A notice: a sheet of paper pinned to the plaza wall. The whole design is a
 * wall of these, so almost every other primitive is something that goes inside
 * one.
 *
 * The paper is tinted with the author's hue — the same hue their avatar is drawn
 * in, taken from `avatarColor` rather than derived again here, so a person's
 * notice and a person's face can never drift apart. It is a wash and not a fill:
 * the surface stays `--color-paper`, with a translucent layer of the hue over
 * it, so the tint follows the paper token if the paper token ever moves, and a
 * browser that cannot parse the oklch simply gets plain paper.
 *
 * Props:
 *   author    — { id }; the hue comes from the id. A missing author is fine and
 *               yields the hue avatarColor gives an empty id, not a crash
 *   as        — the wrapper element (default "article"); "li" for a feed list
 *   padding   — inner padding in px or any CSS length (default 20)
 *   className / style — passed through to the wrapper
 *   ...rest   — anything else lands on the wrapper
 */
const Notice = ({
  author,
  as: Wrapper = "article",
  padding = 20,
  className = "",
  style,
  children,
  ...rest
}) => {
  const { hue } = avatarColor(author?.id);

  // A flat two-stop gradient is just "this colour, everywhere". It buys the one
  // thing a background-color cannot: a translucent layer OVER the paper token
  // rather than instead of it.
  const wash = `oklch(0.62 0.16 ${hue} / 0.08)`;

  return (
    <Wrapper
      {...rest}
      className={className}
      // Published for the children: a control inside a notice that wants to pick
      // up the author's colour can read var(--notice-hue) instead of being
      // handed the author all over again.
      style={{ ...WRAPPER, "--notice-hue": String(hue), ...style }}
    >
      <div
        style={{
          ...SURFACE,
          padding,
          backgroundColor: "var(--color-paper)",
          backgroundImage: `linear-gradient(${wash}, ${wash})`,
        }}
      >
        {children}
      </div>
    </Wrapper>
  );
};

export default Notice;
