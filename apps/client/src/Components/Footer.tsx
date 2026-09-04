import React, { useState } from "react";
import { Link } from "react-router-dom";

/*
 * Same 3-column information architecture as before (Kikar tagline / Links /
 * Legal) and the same links — a re-skin, not a redesign of its content. It
 * stands on the paved ground the same way Navbar does now: no background box
 * of its own, ink/muted text directly on WavesBackground's floor, because
 * those two tokens (unlike paper-ink/paper-muted) are the pair meant for text
 * that is not sitting on a sheet of paper.
 */

const ROOT: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "32px 40px 20px",
  fontFamily: "var(--font-body)",
  color: "var(--color-muted)",
};

const CONTAINER: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-around",
  gap: 24,
  maxWidth: 1100,
  margin: "0 auto",
};

const SECTION: React.CSSProperties = { flex: "1 1 200px", minWidth: 180 };

const BRAND: React.CSSProperties = {
  margin: "0 0 8px",
  fontFamily: "var(--font-display)",
  fontSize: 22,
  color: "var(--color-ink)",
};

// A label style, not a second headline — the same small/bold/uppercase/spaced
// treatment Plaza.js's DATE uses, just anchored to ink rather than muted
// because it is standing in for a heading here.
const HEADING: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--color-ink)",
};

const TAGLINE: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.5 };

const LIST: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const LINK_BASE: React.CSSProperties = {
  color: "var(--color-muted)",
  textDecoration: "none",
  fontSize: 14,
  transition: "color 120ms ease",
};

const DIVIDER = "color-mix(in oklab, var(--color-ink) 14%, transparent)";

const BOTTOM: React.CSSProperties = {
  maxWidth: 1100,
  margin: "24px auto 0",
  paddingTop: 16,
  borderTop: `1px solid ${DIVIDER}`,
  textAlign: "center",
};

const COPY: React.CSSProperties = { margin: 0, fontSize: 12 };

// A hover colour shift is the one interactive touch the old .footer-section
// rules had; an inline style cannot hold :hover, so it is React state here —
// the same reason Navbar's NavLink and Button itself track hover in state.
const FooterLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      style={{
        ...LINK_BASE,
        color: hovered ? "var(--color-accent)" : "var(--color-muted)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  );
};

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={ROOT}>
      <div style={CONTAINER}>
        <div style={SECTION}>
          <h3 style={BRAND}>Kikar</h3>
          <p style={TAGLINE}>Connect, Share, Engage</p>
        </div>

        <div style={SECTION}>
          <h3 style={HEADING}>Links</h3>
          <ul style={LIST}>
            <li>
              <FooterLink to="/">Home</FooterLink>
            </li>
            <li>
              <FooterLink to="/posts">Posts</FooterLink>
            </li>
            <li>
              <FooterLink to="/allusers">Community</FooterLink>
            </li>
          </ul>
        </div>

        <div style={SECTION}>
          <h3 style={HEADING}>Legal</h3>
          <ul style={LIST}>
            <li>
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
            </li>
            <li>
              <FooterLink to="/terms">Terms of Service</FooterLink>
            </li>
            <li>
              <FooterLink to="/contact">Contact Us</FooterLink>
            </li>
          </ul>
        </div>
      </div>

      <div style={BOTTOM}>
        <p style={COPY}>&copy; {currentYear} Kikar. All Rights Reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
