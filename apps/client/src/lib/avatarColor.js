/**
 * The colour a user's avatar is drawn in, derived from their id.
 *
 * Every user who has not uploaded a photo used to get the same grey Gravatar
 * silhouette, so on screens that are mostly people — the feed, the user list —
 * everybody looked identical. Deriving the hue from `user.id` gives each person
 * a stable colour instead: the same on every screen, on every device, with no
 * network request and nothing to store.
 *
 * Lightness and chroma are FIXED and only the hue moves. That is the whole
 * point of stating them here rather than at the call site: a per-user random
 * colour would put a vivid avatar next to a washed-out one and make one person
 * shout louder than another, and the contrast of the initials against their own
 * disc would drift with the hue.
 */

// [lightness, chroma] for the disc and for the initials on it, per ground. The
// dark pair is not the light pair inverted: its text drops to chroma 0.035
// because a light tint at 0.100 glows against a dark disc.
const FILLS = {
  light: { background: [0.9, 0.055], text: [0.4, 0.1] },
  dark: { background: [0.4, 0.085], text: [0.93, 0.035] },
};

// The tint a Notice carries in its author's hue: the same rule as the disc, at
// the strength a whole surface can take rather than a 40px circle. It lives here
// for the same reason the fills do — a palette change has to be one edit, not a
// hunt for magic numbers at call sites.
const WASH = { lightness: 0.62, chroma: 0.16, alpha: 0.08 };

/**
 * The hue, 0-359, for a user id.
 *
 * A plain multiply-and-add string hash: cheap, synchronous, and — unlike
 * anything seeded from Math.random or from an array index — stable for the life
 * of the account, which is what makes the colour recognisable as *that
 * person's*. A missing id is coerced rather than thrown on: a half-loaded user
 * has to render something, not take down the screen it appears on.
 */
export const avatarHue = (id) =>
  [...String(id ?? "")].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

/**
 * The pair of fills for a user id.
 *
 * `ground` is the surface the avatar sits ON, not the active theme. Kikar
 * renders avatars on `paper`, which stays light paper in Slate Night too, so
 * "light" is the default and is correct in both themes; "dark" exists for the
 * presence strip, which sits directly on the paved ground.
 */
export const avatarColor = (id, ground = "light") => {
  const hue = avatarHue(id);
  const fill = FILLS[ground] ?? FILLS.light;

  return {
    hue,
    background: `oklch(${fill.background[0]} ${fill.background[1]} ${hue})`,
    color: `oklch(${fill.text[0]} ${fill.text[1]} ${hue})`,
  };
};

/**
 * The same pair with the hue taken out — the "+3" chip that closes an
 * AvatarGroup. Zero chroma at the identical lightnesses, so it reads as a
 * member of the same family that simply is not a person, rather than as a sixth
 * colour someone picked.
 */
export const neutralAvatarColor = (ground = "light") => {
  const fill = FILLS[ground] ?? FILLS.light;

  return {
    hue: null,
    background: `oklch(${fill.background[0]} 0 0)`,
    color: `oklch(${fill.text[0]} 0 0)`,
  };
};

/**
 * The translucent tint a surface takes in a person's hue.
 *
 * Returned as a colour to layer OVER the paper token, never as a replacement
 * for it: the surface stays the token, so it follows if paper moves, and a
 * browser that cannot parse the oklch falls back to plain paper rather than to
 * nothing.
 */
export const authorWash = (id) =>
  `oklch(${WASH.lightness} ${WASH.chroma} ${avatarHue(id)} / ${WASH.alpha})`;

/**
 * Up to two initials for a name: "Dana Levi" -> "DL", "Dana" -> "D".
 *
 * Every branch here is a name this app actually holds. Names come from Firebase
 * and from a free-text profile field, so they arrive absent, single-word, or
 * padded with whitespace. The spread rather than `word[0]` is so a name opening
 * with an astral character yields that character instead of half of a surrogate
 * pair.
 */
export const initials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0].toUpperCase())
    .join("");
