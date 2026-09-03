import React, { useState } from "react";
import { useHistory, Link } from "../lib/router";
import { useAuth } from "../contexts/AuthContext";
import { useNarrowerThan } from "../lib/useMediaQuery";
import { COMPACT } from "./Plaza";
import Button from "./ui/Button";
import SearchBar from "./SearchBar";

/*
 * The chrome around every screen that is not the plaza itself — see the
 * comment on OffPlaza in App.js. It stands directly on WavesBackground's
 * paved floor (fixed, zIndex -1, behind everything), the same way Plaza.js's
 * own header stands on the ground it paints. Slate tokens throughout, inline
 * styles rather than a stylesheet — the same convention every other rebuilt
 * screen and primitive follows (see the header of Components/ui/Button.js),
 * originally because a legacy index.css would have won over any Tailwind
 * utility class; that file is gone now, but the convention is what keeps
 * every screen in one vocabulary.
 *
 * Icons are inline SVG on a 24 grid, stroke-based, the same Glyph pattern
 * PostCard.js and ui/EmptyState.js use — never emoji, never the FontAwesome
 * classes this file used to reach for.
 */
const Glyph = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const UsersIcon = () => (
  <Glyph>
    <circle cx="8" cy="8.5" r="3" />
    <path d="M2.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 6a3 3 0 0 1 0 5.8" />
    <path d="M16.5 13.7a5 5 0 0 1 5 5.8" />
  </Glyph>
);

const PenIcon = () => (
  <Glyph>
    <path d="M15 4.5l4.5 4.5L8 20.5H3.5V16z" />
    <path d="M13 6.5l4.5 4.5" />
  </Glyph>
);

const UserXIcon = () => (
  <Glyph>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 7.5l5 5" />
    <path d="M21.5 7.5l-5 5" />
  </Glyph>
);

const HomeIcon = () => (
  <Glyph>
    <path d="M4 11.5L12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1v-9" />
  </Glyph>
);

const UserPlusIcon = () => (
  <Glyph>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M18.5 6.5v6" />
    <path d="M15.5 9.5h6" />
  </Glyph>
);

const SignInIcon = () => (
  <Glyph>
    <path d="M11 4.5h6a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6" />
    <path d="M3 12h11.5" />
    <path d="M10.5 8l4 4-4 4" />
  </Glyph>
);

const MenuIcon = () => (
  <Glyph>
    <path d="M3.5 6.5h17" />
    <path d="M3.5 12h17" />
    <path d="M3.5 17.5h17" />
  </Glyph>
);

const CloseIcon = () => (
  <Glyph>
    <path d="M5.5 5.5l13 13" />
    <path d="M18.5 5.5l-13 13" />
  </Glyph>
);

const WORDMARK: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 26,
  letterSpacing: "-0.02em",
  lineHeight: 1,
  color: "var(--color-ink)",
  textDecoration: "none",
  flexShrink: 0,
};

const NAV_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const MOBILE_NAV: React.CSSProperties = {
  flexBasis: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 8,
};

// The ghost pill a plain <Link> draws itself into — Button's BASE + METRICS[34]
// + `ghost` skin, restated by hand because Button only ever renders a
// <button>, and Sign in/Sign up have to stay real, router-navigable <a> tags
// (right-click "open in new tab" included) rather than an onClick pretending
// to be one.
const LINK_PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 34,
  boxSizing: "border-box",
  paddingInline: 14,
  borderRadius: "var(--radius-pill)",
  border: "2px solid transparent",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 13,
  lineHeight: 1,
  color: "inherit",
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "background 120ms ease",
};

const LINK_HOVER = "color-mix(in oklab, currentColor 10%, transparent)";
const LINK_FOCUS_RING: React.CSSProperties = {
  outline: "2px solid var(--color-accent)",
  outlineOffset: 2,
};

// A <Link> that takes on Button's ghost hover/focus behaviour. Button itself
// tracks these in React state rather than CSS because an inline style cannot
// hold a pseudo-class — see its header comment — and a bare <a> needs the
// same treatment for the same reason.
const NavLink = ({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}) => {
  const [hovered, setHovered] = useState(false);
  const [ringVisible, setRingVisible] = useState(false);

  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        ...LINK_PILL,
        background: hovered ? LINK_HOVER : "transparent",
        ...(ringVisible ? LINK_FOCUS_RING : null),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event: React.FocusEvent<HTMLAnchorElement>) =>
        setRingVisible(event.target.matches(":focus-visible"))
      }
      onBlur={() => setRingVisible(false)}
    >
      {children}
    </Link>
  );
};

const Navbar = () => {
  const { logout, currentUser } = useAuth();
  const history = useHistory();
  const [isMenuActive, setIsMenuActive] = useState(false);
  // Same breakpoint Plaza's own header collapses at, imported rather than
  // restated — see the comment on COMPACT there about copies drifting.
  const compact = useNarrowerThan(COMPACT);

  const handleLogout = async () => {
    await logout();
    history.push("/signin");
  };

  const handleNavigate = (path: string) => {
    history.push(path);
    setIsMenuActive(false); // close the menu on navigation
  };

  const toggleNavbar = () => setIsMenuActive((active) => !active);

  // Built once and dropped into whichever single <nav> renders this pass —
  // the full-width panel when the menu is open on a narrow screen, or the
  // inline row otherwise. The two never render together, so this is never
  // duplicated in the actual tree.
  const items = currentUser ? (
    <>
      <Button variant="ghost" size={34} onClick={() => handleNavigate("/allusers")}>
        <UsersIcon />
        People
      </Button>
      <Button variant="ghost" size={34} onClick={() => handleNavigate("/posts")}>
        <PenIcon />
        Posts
      </Button>
      <Button variant="ghost" size={34} onClick={handleLogout}>
        <UserXIcon />
        Log out
      </Button>
      <Button variant="ghost" size={34} onClick={() => handleNavigate("/")}>
        <HomeIcon />
        Home
      </Button>
    </>
  ) : (
    <>
      <NavLink to="/signup" onClick={() => setIsMenuActive(false)}>
        <UserPlusIcon />
        Sign up
      </NavLink>
      <NavLink to="/signin" onClick={() => setIsMenuActive(false)}>
        <SignInIcon />
        Sign in
      </NavLink>
    </>
  );

  return (
    <header
      style={{
        boxSizing: "border-box",
        fontFamily: "var(--font-body)",
        color: "var(--color-ink)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          boxSizing: "border-box",
          padding: compact ? "16px 16px 14px" : "18px 40px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: compact ? 12 : 18,
        }}
      >
        <Link to="/" style={WORDMARK} onClick={() => setIsMenuActive(false)}>
          KIKAR
        </Link>

        <div style={{ flexGrow: 1 }} />

        {compact ? (
          <Button
            variant="ghost"
            size={40}
            onClick={toggleNavbar}
            aria-expanded={isMenuActive}
            aria-controls="navbar-menu"
            aria-label={isMenuActive ? "Close menu" : "Open menu"}
          >
            {isMenuActive ? <CloseIcon /> : <MenuIcon />}
          </Button>
        ) : (
          <>
            {currentUser && (
              <div style={{ flex: "0 1 320px", minWidth: 0 }}>
                <SearchBar />
              </div>
            )}
            <nav aria-label="Account" style={NAV_ROW}>
              {items}
            </nav>
          </>
        )}

        {/* flexBasis: 100% is the flexbox line break Plaza's header also
            relies on — it fills the row it lands on, so whatever follows
            starts on a fresh one. */}
        {compact && currentUser && (
          <div style={{ flexBasis: "100%", minWidth: 0 }}>
            <SearchBar />
          </div>
        )}

        {/* Rendered (hidden, not unmounted) whenever compact — not only while
            open — so the toggle button's aria-controls always names an id
            that actually exists in the document. */}
        {compact && (
          <nav
            id="navbar-menu"
            aria-label="Account"
            style={MOBILE_NAV}
            hidden={!isMenuActive}
          >
            {items}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navbar;
