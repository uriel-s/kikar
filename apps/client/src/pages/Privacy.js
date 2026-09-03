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

// color: "inherit" is load-bearing, not decorative. index.css still carries
// a bare, unlayered `p { color: #e4e6eb; ... }` for the screens not yet
// rebuilt — an element rule beats the paper-ink Notice's SURFACE sets on its
// wrapper div, so without this every paragraph here would render pale grey
// on light paper. PostCard's CONTENT/COMMENT_TEXT make the identical fix
// against the identical rule.
const BODY_TEXT = {
  margin: "0 0 16px",
  fontSize: 15,
  lineHeight: 1.6,
  color: "inherit",
};

const LIST = {
  margin: "0 0 16px",
  paddingLeft: 22,
  fontSize: 15,
  lineHeight: 1.6,
  color: "inherit",
  // Explicit, not inherited from the browser default: index.css used to carry
  // a `ul,ol { list-style: revert }` bridge rule that restored bullets over
  // Tailwind preflight's `list-style: none`, and that bridge is gone together
  // with index.css. Stated here so this list's bullets do not depend on either.
  listStyle: "disc",
};

const Privacy = () => {
  return (
    <div style={FRAME}>
      <h1 style={TITLE}>Privacy Policy</h1>

      <Notice as="div">
        <h2 style={FIRST_SECTION_TITLE}>1. Information We Collect</h2>
        <p style={BODY_TEXT}>
          We collect information when you register on our site, log into your account,
          make a post, and participate in other activities on our platform. The
          information may include your name, email address, profile picture, and any
          content you create or share.
        </p>

        <h2 style={SECTION_TITLE}>2. How We Use Your Information</h2>
        <p style={BODY_TEXT}>We use the information we collect to:</p>
        <ul style={LIST}>
          <li>Provide, maintain, and improve our services</li>
          <li>Create and maintain your account</li>
          <li>Personalize your experience</li>
          <li>Communicate with you about our services</li>
        </ul>

        <h2 style={SECTION_TITLE}>3. Information Sharing</h2>
        <p style={BODY_TEXT}>
          We do not sell, trade, or otherwise transfer your personally identifiable
          information to outside parties without your consent, except as required for
          providing the services you requested.
        </p>

        <h2 style={SECTION_TITLE}>4. Data Security</h2>
        <p style={BODY_TEXT}>
          We implement appropriate security measures to protect your personal information
          against unauthorized access, alteration, disclosure, or destruction.
        </p>

        <h2 style={SECTION_TITLE}>5. Changes to This Policy</h2>
        <p style={BODY_TEXT}>
          We may update our Privacy Policy from time to time. We will notify you of any
          changes by posting the new Privacy Policy on this page.
        </p>

        <h2 style={SECTION_TITLE}>6. Contact Us</h2>
        <p style={BODY_TEXT}>
          If you have any questions about this Privacy Policy, please contact us at
          support@kikar.com.
        </p>
      </Notice>
    </div>
  );
};

export default Privacy;
