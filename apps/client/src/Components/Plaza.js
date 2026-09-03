import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PlazaProfileContext } from "../contexts/PlazaProfile";
import * as usersApi from "../api/users";
import { useNarrowerThan, usePrefersDark } from "../lib/useMediaQuery";
import Avatar from "./Avatar";
import SearchBar from "./SearchBar";

/*
 * The plaza: the paved ground and the header standing on it, as ONE element.
 *
 * That is the load-bearing constraint of this screen, not a tidiness
 * preference. The paving is a repeating-conic-gradient and a
 * repeating-radial-gradient struck from a single vanishing point at 50% 22%,
 * and that point is where the composer stands. A gradient's geometry is
 * relative to its own box, so a header that carried `paving` of its own would
 * strike the pattern again from its own 22% — two floors meeting at a seam,
 * with the courses and the joints out of step. The town square is structural:
 * one floor, struck once, with everything else standing on top of it. Hence
 * `children` rather than a <PlazaHeader/> each screen positions for itself.
 *
 * Inline styles, not Tailwind utility classes — the full reasoning is in the
 * header of Components/ui/Button.js. index.css is 877 unlayered lines and
 * outranks Tailwind's @layer utilities wholesale, so `bg-paper rounded-pill`
 * would render as whatever index.css says. `paving` is the single exception,
 * and deliberately so: it is an @utility in theme.css because the three
 * gradients must have exactly one definition in the codebase, and no rule in
 * index.css competes for a background-image here.
 */

// Below this the header can no longer hold one row, and the ground's desktop
// padding is most of a phone's width.
const COMPACT = 900;
// The mobile artboard carries no date, and below this there is no room for one.
const NARROW = 560;

/*
 * Built once; formatting is the cheap half of using an Intl formatter.
 *
 * The locale is pinned to "en" for exactly the reason lib/timeAgo.js pins its
 * own: every other string in this app is hard-coded English, so honouring the
 * browser's locale would put one Hebrew or French word on an otherwise English
 * screen. Here it also has to agree with timeAgo — the header's date sits a
 * few centimetres from a post's "12 minutes ago", and two formatters
 * disagreeing about the language would be visible in one glance.
 */
const dateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const NAV = [
  { label: "The square", to: "/" },
  { label: "People", to: "/allusers" },
  { label: "You", to: "/me" },
];

// "/" matches only itself — every path starts with it. The others own their
// subtrees, so /me/settings still lights "You" rather than nothing.
const isCurrent = (pathname, to) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

const WORDMARK = {
  fontFamily: "var(--font-display)",
  fontSize: 42,
  letterSpacing: "-0.025em",
  lineHeight: 1,
  color: "var(--color-ink)",
  textDecoration: "none",
};

const DATE = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
  whiteSpace: "nowrap",
};

const PILL = {
  padding: "9px 17px",
  borderRadius: "var(--radius-pill)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

/*
 * The two themes use genuinely different token pairs for the pills, and the
 * artboards say so rather than leaving it to be derived. Slate Day: the active
 * pill is ink with a near-white label, the idle ones are paper. Slate Night:
 * the active pill is the accent, and the idle ones are chip.
 *
 * That is not decoration, it is the only thing that works. Ink is near-WHITE in
 * Slate Night, so carrying the day pair over made the active pill 0.945 sitting
 * among idle pills at 0.980 — the current page marked by a difference nobody
 * can see. The accent is the one token that is loud in both themes, and at
 * night it is the one that has somewhere to go.
 *
 * Measured: day 10.54 active / 15.73 idle, night 9.65 active / 9.06 idle. The
 * night idle pill is only 1.48:1 against the paving, which is deliberate — it
 * is a shape behind a label, not a control boundary, and the label itself is
 * the thing that has to be found.
 */
const PILL_ACTIVE = {
  day: { background: "var(--color-ink)", color: "var(--color-ground)" },
  night: { background: "var(--color-accent)", color: "var(--color-on-accent)" },
};

const PILL_IDLE = {
  day: { background: "var(--color-paper)", color: "var(--color-paper-ink)" },
  night: { background: "var(--color-chip)", color: "var(--color-ink)" },
};

/**
 * The plaza shell.
 *
 * Props:
 *   children — the screen that stands on the ground, rendered inside the same
 *              1100px column as the header
 */
const Plaza = ({ children }) => {
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const compact = useNarrowerThan(COMPACT);
  // The pills are the one place the two palettes do not share a rule; see above.
  const night = usePrefersDark();
  const narrow = useNarrowerThan(NARROW);
  const [profile, setProfile] = useState(null);

  const uid = currentUser?.uid;

  /*
   * The Firebase user carries a photoURL and it is never the one to draw:
   * avatars are uploaded to our own server and stored on the user row, which
   * never touches the Firebase account record, so reading photoURL would show
   * every user their initials forever. One request, the same one Dashboard
   * makes.
   *
   * Until it lands the avatar renders from { id: uid } alone, which is all
   * avatarColor needs — the disc appears in the right person's hue immediately
   * and the initials fill in, instead of the header re-laying out when the
   * profile resolves.
   */
  useEffect(() => {
    if (!uid) return undefined;

    let cancelled = false;

    usersApi
      .getUser(uid)
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch(() => {
        // Deliberately silent. A header avatar is not worth an error banner:
        // the hue-and-initials fallback is already a correct avatar for this
        // person, and the screen underneath reports its own failures.
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const me = profile ?? { id: uid };

  return (
    <div
      className="paving"
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: compact ? "20px 16px 28px" : "40px 40px 46px",
        color: "var(--color-ink)",
        fontFamily: "var(--font-body)",
        /*
         * index.css gives `.App` `text-align: center`, and text-align inherits,
         * so without this every notice on the wall reads centred. Stated here
         * rather than deleted there on purpose: that one declaration is still
         * what lays out the nine screens which have not been rebuilt, so
         * removing it would silently re-align all of them to fix this one. The
         * ground is the exact boundary of what this screen owns.
         */
        textAlign: "left",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: compact ? 14 : 22,
          }}
        >
          <Link to="/" style={WORDMARK}>
            KIKAR
          </Link>

          {!narrow && <span style={DATE}>{dateFormatter.format(new Date())}</span>}

          <div style={{ flexGrow: 1 }} />

          {/*
           * A zero-height item with a 100% basis is the flexbox line break: it
           * fills the first row so everything after it starts on the second.
           * The alternative — a second <header> for small screens — would mean
           * two copies of the same markup drifting apart.
           */}
          {compact && <div style={{ flexBasis: "100%", height: 0 }} />}

          {/*
           * A deviation from both artboards, on purpose: the desktop one omits
           * search entirely and the mobile one draws an icon that opens
           * something that does not exist. /search is a working feature with a
           * page behind it, and a redesign is not the moment to delete one.
           * SearchBar carries Slate tokens now — index.css styles every bare
           * <input> dark, and it is the only input on this screen that is not
           * a Field. The search SCREEN is still unrebuilt; only the control is.
           */}
          <div style={{ flex: compact ? "1 1 200px" : "0 1 320px", minWidth: 0 }}>
            <SearchBar />
          </div>

          <nav aria-label="Plaza" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {NAV.map(({ label, to }) => {
              const current = isCurrent(pathname, to);

              // aria-current, because the fill and label colours are the only
              // other thing marking this pill as the page you are on, and a
              // colour is not something a screen reader can hear.
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={current ? "page" : undefined}
                  style={{
                    ...PILL,
                    ...(current ? PILL_ACTIVE : PILL_IDLE)[night ? "night" : "day"],
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <Link
            to="/me"
            aria-label="Your profile"
            style={{
              display: "inline-flex",
              flexShrink: 0,
              borderRadius: "50%",
              // Bootstrap underlines every <a>, and an inline-flex box is not
              // atomic, so the rule reached straight through to the initials
              // inside the disc. The wordmark and the pills state this too.
              textDecoration: "none",
              // The ring is what lifts the disc off the paving; it is the
              // keyline rather than the ground because a notice's rim is the
              // same colour in both themes, so one value works in both.
              boxShadow: "0 0 0 3px var(--color-keyline)",
            }}
          >
            <Avatar user={me} size={40} />
          </Link>
        </header>

        {/* Published rather than passed: the composer wants this same person
            and must not fetch the row a second time. See PlazaProfile.js. */}
        <PlazaProfileContext.Provider value={profile}>
          {children}
        </PlazaProfileContext.Provider>
      </div>
    </div>
  );
};

export default Plaza;
