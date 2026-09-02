/**
 * Relative timestamps for the feed.
 *
 * `createdAt` has always arrived on every post and every comment and the client
 * has never rendered it, so a wall of notices reads as one undated pile. This is
 * the whole of the formatting: `Intl.RelativeTimeFormat` already knows the
 * plurals and the irregular words ("yesterday", not "1 day ago"), so nothing
 * here builds a string by hand.
 */

/*
 * A single formatter, built once. A feed renders one timestamp per post plus one
 * per comment, and constructing an Intl formatter is the expensive part of using
 * one — the format call itself is cheap.
 *
 * The locale is pinned to "en" rather than left to the runtime on purpose: every
 * other string in this app is hard-coded English, so honouring the browser's
 * locale here would put the one Hebrew or French word on an otherwise English
 * screen. When the app is actually translated, this is the line that changes.
 *
 * `numeric: "auto"` is what produces "yesterday" instead of "1 day ago"; without
 * it the whole family of natural forms is lost.
 */
const LOCALE = "en";
const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

// Largest first: the first unit the elapsed time reaches is the one it is said
// in. Months and years are the usual calendar approximations — a feed is not an
// almanac, and "2 months ago" being a day out is not a defect anyone can see.
const UNITS = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

// Below this, "now". 45s rather than 60s so the last stretch of the first minute
// does not tick "58 seconds ago" at a reader who watched the post appear.
const NOW_WINDOW = 45;

/**
 * A Date, or null if the value cannot be one.
 *
 * The three accepted shapes are the three that actually occur: a Date from
 * calling code, the ISO string the API returns, and an epoch number from
 * `Date.now()`. Everything else — undefined from a half-loaded row, an empty
 * string, a malformed date — is null, because the alternative is one bad row
 * printing "Invalid Date" or throwing and taking the whole feed down with it.
 */
const toDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * A short relative time: "12 minutes ago", "2 hours ago", "yesterday",
 * "5 days ago".
 *
 * Returns "" for anything unreadable, so a call site can write
 * `{timeAgo(post.createdAt)}` with no guard and get an absent timestamp rather
 * than a broken one.
 */
export const timeAgo = (value) => {
  const date = toDate(value);
  if (!date) return "";

  // Negative in the past, which is the sign RelativeTimeFormat wants. Positive
  // values are not an error to defend against: a client clock a few minutes
  // behind the server produces them, and "in 2 minutes" is a truer thing to show
  // than a clamped "now".
  const elapsed = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(elapsed) < NOW_WINDOW) return formatter.format(0, "second");

  const [unit, span] = UNITS.find(([, seconds]) => Math.abs(elapsed) >= seconds);

  // Truncated, not rounded: 100 minutes is "1 hour ago", never "2 hours ago". A
  // relative time is read as "at least this long", so rounding up claims more
  // time has passed than actually has.
  return formatter.format(Math.trunc(elapsed / span), unit);
};

/**
 * The same instant as an ISO string, for a `<time dateTime>` attribute.
 *
 * `undefined` rather than "" when the value is unreadable, because React omits
 * an attribute that is undefined — and `<time dateTime="">` is invalid markup
 * that assistive technology would read as an empty machine-readable date.
 */
export const machineTime = (value) => toDate(value)?.toISOString();
