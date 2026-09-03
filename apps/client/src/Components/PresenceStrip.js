import React from "react";
import { useNarrowerThan, usePrefersDark } from "../lib/useMediaQuery";
import { AvatarGroup } from "./Avatar";

// The header's own second breakpoint. A strip that thinned out at a width it
// invented would drop faces half a beat before or after the row above it
// reflows, which is visible as a stutter rather than as a layout.
const NARROW = 560;

// Six faces on the desktop artboard, four on the mobile one.
const FACES = 6;
const NARROW_FACES = 4;

/*
 * The artboard draws 38px discs and AVATAR_SIZES is [20, 28, 40, 56, 84].
 * 40, then, and the two pixels are the deviation: that array is exported
 * precisely so a screen cannot quietly add a sixth step, and a strip of faces
 * that is 2px off the mock is not the reason to be the screen that does.
 */
const FACE_SIZE = 40;

const ROOT = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Wraps rather than overflows: at four faces plus two runs of text there is
  // no width at which forcing one line does anything but push the remainder off
  // the side of a phone.
  flexWrap: "wrap",
  gap: 16,
};

const LABEL = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
};

const REMAINDER = { fontSize: 12.5, color: "var(--color-muted)" };

/**
 * "In the square right now" — a row of the people who are here.
 *
 * Fetches nothing, on purpose. Who counts as present is a question about the
 * whole screen, not about a row of discs, and the answer is going to change
 * (there is no presence endpoint on this server yet); taking the people as a
 * prop is what keeps that change to one line in the page above.
 *
 * Props:
 *   people    — the people to draw, most relevant first; each { id, name,
 *               avatarUrl }. An empty list renders nothing at all
 *   className / style — passed through to the row
 */
const PresenceStrip = ({ people = [], className = "", style }) => {
  const narrow = useNarrowerThan(NARROW);
  /*
   * avatarColor’s `ground` names the SURFACE the disc sits on, not the theme,
   * and this is the one place in the app where those two come apart: a notice
   * is light paper in both themes, but the paved ground is pale bluestone by
   * day and dark slate at night. Hard-coding "dark" — which the primitive’s own
   * comment suggested, on the assumption the plaza was always dark — put six
   * heavy dark discs on the pale day ground, next to the pale discs on the
   * notices directly below them.
   */
  const onDarkGround = usePrefersDark();
  const limit = narrow ? NARROW_FACES : FACES;

  // Nothing, rather than a label over an empty row. "In the square right now"
  // followed by no one reads as a claim that the square is empty, and that is
  // not a claim this strip is in a position to make.
  if (people.length === 0) return null;

  const faces = people.slice(0, limit);
  const extra = people.length - faces.length;

  return (
    <div className={className} style={{ ...ROOT, ...style }}>
      <span style={LABEL}>In the square right now</span>

      {/*
       * `ground` follows the paving rather than the theme's name — see
       * onDarkGround above. It picks both the initials' fill and the ring that
       * separates one overlapping disc from the next.
       *
       * `max` is exactly the number of faces, so AvatarGroup renders no "+N"
       * chip. The artboard closes the row with the words "and 12 more", which
       * is a sentence and not a seventh face; handing the group the full list
       * would draw the chip instead and say the same thing twice.
       */}
      <AvatarGroup
        users={faces}
        max={faces.length}
        size={FACE_SIZE}
        ground={onDarkGround ? "dark" : "light"}
      />

      {extra > 0 && <span style={REMAINDER}>and {extra} more</span>}
    </div>
  );
};

export default PresenceStrip;
