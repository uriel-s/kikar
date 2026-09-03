import React from "react";
import Notice from "../Components/ui/Notice";

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notice on it and keep it off the screen edge on a phone. Wider than the
// 440px auth frame (Signin/SignUp): this is prose, not a form, and 720px
// reads well as a legal document's line length.
const FRAME = {
  maxWidth: 720,
  margin: "48px auto 60px",
  padding: "0 20px",
  boxSizing: "border-box",
};

// ink, not paper-ink: this heading sits on the paved ground above the
// notice, not on paper inside it — same reasoning Footer.js gives for its
// own text, and the same split Signin/SignUp's TITLE vs. FOOTER draw.
const TITLE = {
  margin: "0 0 20px",
  fontFamily: "var(--font-display)",
  fontSize: 32,
  lineHeight: 1.2,
  color: "var(--color-ink)",
};

const SECTION_TITLE = {
  margin: "28px 0 10px",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  lineHeight: 1.3,
};

const FIRST_SECTION_TITLE = { ...SECTION_TITLE, marginTop: 0 };

// color: "inherit" is stated explicitly rather than left to be inherited.
// index.css used to carry a bare, unlayered `p { color: #e4e6eb; ... }` —
// an element rule that would have beaten the paper-ink Notice's SURFACE sets
// on its wrapper div, so every paragraph here would have rendered pale grey
// on light paper. Gone together with index.css, but stated here anyway so
// this list does not depend on a rule that no longer exists — the same fix
// PostCard's CONTENT/COMMENT_TEXT make against the same rule.
const BODY_TEXT = {
  margin: "0 0 16px",
  fontSize: 15,
  lineHeight: 1.6,
  color: "inherit",
};

const Terms = () => {
  return (
    <div style={FRAME}>
      <h1 style={TITLE}>Terms of Service</h1>

      <Notice as="div">
        <h2 style={FIRST_SECTION_TITLE}>1. Acceptance of Terms</h2>
        <p style={BODY_TEXT}>
          By accessing or using our service, you agree to be bound by these Terms of
          Service. If you do not agree with any part of these terms, you may not use our
          service.
        </p>

        <h2 style={SECTION_TITLE}>2. User Accounts</h2>
        <p style={BODY_TEXT}>
          You are responsible for safeguarding the password that you use to access the
          service and for any activities or actions under your password. You agree not to
          disclose your password to any third party.
        </p>

        <h2 style={SECTION_TITLE}>3. User Content</h2>
        <p style={BODY_TEXT}>
          Our service allows you to post, link, store, share and otherwise make available
          certain information, text, graphics, videos, or other material. You are
          responsible for the content you post.
        </p>

        <h2 style={SECTION_TITLE}>4. Prohibited Uses</h2>
        <p style={BODY_TEXT}>
          You may not use our service for any illegal or unauthorized purpose nor may you,
          in the use of the service, violate any laws in your jurisdiction.
        </p>

        <h2 style={SECTION_TITLE}>5. Termination</h2>
        <p style={BODY_TEXT}>
          We may terminate or suspend your account immediately, without prior notice or
          liability, for any reason whatsoever, including without limitation if you breach
          the Terms.
        </p>

        <h2 style={SECTION_TITLE}>6. Changes to Terms</h2>
        <p style={BODY_TEXT}>
          We reserve the right, at our sole discretion, to modify or replace these Terms
          at any time. If a revision is material we will try to provide at least 30 days
          notice prior to any new terms taking effect.
        </p>

        <h2 style={SECTION_TITLE}>7. Contact Us</h2>
        <p style={BODY_TEXT}>
          If you have any questions about these Terms, please contact us at
          support@kikar.com.
        </p>
      </Notice>
    </div>
  );
};

export default Terms;
