import React, { useState } from "react";
import { avatarColor, initials, neutralAvatarColor } from "../lib/avatarColor";

/**
 * The approved size steps, in px. Exported so call sites can name a step
 * (`AVATAR_SIZES[2]` is not the point — `size={40}` is) and so a later screen
 * cannot quietly invent a sixth one.
 */
export const AVATAR_SIZES = [20, 28, 40, 56, 84];

const DEFAULT_SIZE = 40;

// The initials are ~0.34 of the disc. Written inline as a px fallback and again
// as `34cqh` on the text itself: the container-query unit is what keeps the
// ratio when a stylesheet, not this component, decides how big the disc is.
const TEXT_RATIO = 0.34;

const boxOf = (px) => ({
  width: px,
  height: px,
  fontSize: Math.round(px * TEXT_RATIO),
});

/**
 * An incoming `className` owns the box unless `size` is passed explicitly.
 *
 * Dashboard, PostCard and UserCard size their avatars in index.css
 * (`.dashboard-avatar` is 150px, `.user-img` is 100%), and an inline width beats
 * a stylesheet every time — defaulting to a step would silently resize all three
 * screens, which this stage is not rebuilding. So: an explicit `size` wins,
 * because the caller asked for it; otherwise a class means "the stylesheet has
 * this covered", and only a bare <Avatar user={user} /> falls back to the step.
 */
const boxFor = (size, className) => {
  if (typeof size === "number") return boxOf(size);
  return className ? null : boxOf(DEFAULT_SIZE);
};

// `containerType: size` is what makes `34cqh` below resolve against the disc.
// It also means the disc's size never depends on its text, so `aspectRatio`
// keeps it round even when the only thing a legacy class sets is a width.
const DISC = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  aspectRatio: "1",
  borderRadius: "50%",
  overflow: "hidden",
  containerType: "size",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: "0.02em",
  userSelect: "none",
};

/**
 * Renders a user's avatar from the URL the API already returned.
 *
 * Dashboard, PostCard, and UserCard each used to call the Firebase Storage SDK
 * directly and resolve a download URL per render — a network round trip per
 * avatar per component, plus a thrown-and-caught error for every user who had
 * never uploaded one. The server stores the URL on the user row now, so there
 * is nothing to look up.
 *
 * Without a photo it draws initials on the hue derived from the user's id. The
 * old fallback was one grey Gravatar silhouette fetched from an external host,
 * which meant a request per avatar and, worse, that every user without a photo
 * looked like the same person.
 *
 * Props:
 *   user      — { id, name, avatarUrl }; a partial or missing user still renders
 *   size      — px, one of AVATAR_SIZES; see boxFor for what omitting it means
 *   ground    — "light" (default, the paper surface) | "dark" (the paved ground)
 *   className — passed straight through; kept for the three legacy screens
 *   alt       — overrides the accessible name on both the photo and the initials
 */
const Avatar = ({ user, size, className = "", alt, ground = "light" }) => {
  const [failed, setFailed] = useState(false);
  const label = alt ?? `${user?.name ?? "User"}'s avatar`;
  const box = boxFor(size, className);

  if (!failed && user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={label}
        className={className}
        style={{ ...box, borderRadius: "50%", objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    );
  }

  const { background, color } = avatarColor(user?.id, ground);

  // role="img" + aria-label, not a bare <span> holding "DL": the initials are a
  // picture of a person drawn in text, so a screen reader has to hear the name
  // the <img> alt gave it and not two stray letters.
  return (
    <span
      role="img"
      aria-label={label}
      className={className}
      style={{ ...DISC, ...box, background, color }}
    >
      <span aria-hidden="true" style={{ fontSize: `${TEXT_RATIO * 100}cqh` }}>
        {initials(user?.name)}
      </span>
    </span>
  );
};

/**
 * Overlapping faces — "Dana, Yossi and 3 others".
 *
 * Each face carries a ring in the colour of the surface behind it, which is the
 * only thing that separates one disc from the one it overlaps; without it two
 * users with neighbouring hues merge into a single blob. The ring therefore
 * follows `ground` by default and is overridable for a surface that is neither.
 *
 * Props:
 *   users     — the people to show; the first `max` get a face
 *   max       — how many faces before the "+N" chip (default 3)
 *   size      — px, one of AVATAR_SIZES (default 28)
 *   ground    — as Avatar; also picks the default ring colour
 *   ring      — ring colour override, e.g. a card that is neither paper nor ground
 *   className — passed through to the wrapper
 */
export const AvatarGroup = ({
  users = [],
  max = 3,
  size = 28,
  ground = "light",
  ring,
  className = "",
}) => {
  const faces = users.slice(0, Math.max(max, 0));
  const extra = users.length - faces.length;
  const ringColor =
    ring ?? (ground === "dark" ? "var(--color-ground)" : "var(--color-paper)");
  const ringWidth = size <= 28 ? 2 : 3;
  // A third of a face: enough overlap to read as a stack, not so much that the
  // initials underneath are covered.
  const overlap = Math.round(size / 3);
  const { background, color } = neutralAvatarColor(ground);

  const stacked = (index) => ({
    display: "inline-flex",
    borderRadius: "50%",
    marginLeft: index === 0 ? 0 : -overlap,
    boxShadow: `0 0 0 ${ringWidth}px ${ringColor}`,
  });

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center" }}>
      {faces.map((user, index) => (
        <span key={user?.id ?? index} style={stacked(index)}>
          <Avatar user={user} size={size} ground={ground} />
        </span>
      ))}

      {extra > 0 && (
        <span
          role="img"
          aria-label={`${extra} more`}
          style={{
            ...DISC,
            ...boxOf(size),
            ...stacked(faces.length),
            background,
            color,
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
};

export default Avatar;
