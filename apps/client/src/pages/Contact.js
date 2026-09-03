import React, { useState } from "react";
import Button from "../Components/ui/Button";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";

/*
 * Icon is inline SVG on a 24 grid, stroke-based — the pattern PostCard's
 * Glyph establishes for exactly this reason: `stroke="currentColor"` lets
 * one drawing work on paper in both themes with no colour of its own.
 */
const CheckIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notices on it and keep them off the screen edge on a phone. Narrower than
// Privacy/Terms' 720px: this is a form, not a wall of prose.
const FRAME = {
  maxWidth: 600,
  margin: "48px auto 60px",
  padding: "0 20px",
  boxSizing: "border-box",
};

// ink, not paper-ink: this heading sits on the paved ground above the
// notices, not on paper inside one — same reasoning Footer.js gives for its
// own text, and the same split Signin/SignUp's TITLE vs. FOOTER draw.
const TITLE = {
  margin: "0 0 20px",
  fontFamily: "var(--font-display)",
  fontSize: 32,
  lineHeight: 1.2,
  color: "var(--color-ink)",
};

const FIELD_GAP = { marginTop: 14 };

const ACTIONS = { marginTop: 20 };

const CONFIRMATION = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
  // Not --color-like: a success message is not an error, so it stays in the
  // paper's own ink rather than borrowing the convention reserved for
  // failures. See Field's ERROR / this file's own INFO_LINE for the rule
  // this deliberately does not follow.
  color: "inherit",
};

// A second sheet of paper below the form — the current markup's second
// `.card`, kept as its own distinct Notice rather than folded into the form.
const INFO_NOTICE = { marginTop: 24 };

const SECTION_TITLE = {
  margin: "0 0 14px",
  fontFamily: "var(--font-display)",
  fontSize: 18,
  lineHeight: 1.3,
};

// color: "inherit" is stated explicitly rather than left to be inherited.
// index.css used to carry a bare, unlayered `p { color: #e4e6eb; ... }` —
// an element rule that would have beaten the paper-ink Notice's SURFACE sets
// on its wrapper div, so this line here would have rendered pale grey on
// light paper. Gone together with index.css, but stated here anyway so this
// line does not depend on a rule that no longer exists — the same fix
// PostCard's CONTENT/COMMENT_TEXT make against the same rule.
const INFO_LINE = {
  margin: "0 0 10px",
  fontSize: 15,
  lineHeight: 1.6,
  color: "inherit",
};

const EMPTY_FORM = { name: "", email: "", subject: "", message: "" };

const Contact = () => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the form data to your server
    console.log(formData);
    // For demo purposes, we'll just show a success message
    setSubmitted(true);
    // Reset form
    setFormData(EMPTY_FORM);
  };

  return (
    <div style={FRAME}>
      <h1 style={TITLE}>Contact Us</h1>

      {submitted ? (
        <Notice as="div">
          {/* role="status": this replaces the form after a successful submit
              rather than being present all along, so a screen-reader user
              needs the same kind of interrupt the role="alert" errors below
              get — just the non-urgent variant, since nothing failed. */}
          <p role="status" style={CONFIRMATION}>
            <CheckIcon />
            Thank you for your message! We will get back to you soon.
          </p>
        </Notice>
      ) : (
        <Notice as="form" onSubmit={handleSubmit}>
          <Field
            label="Name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <div style={FIELD_GAP}>
            <Field
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div style={FIELD_GAP}>
            <Field
              label="Subject"
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
            />
          </div>

          <div style={FIELD_GAP}>
            <Field
              as="textarea"
              label="Message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={5}
              required
            />
          </div>

          <div style={ACTIONS}>
            <Button type="submit" variant="primary">
              Submit
            </Button>
          </div>
        </Notice>
      )}

      <Notice as="div" style={INFO_NOTICE}>
        <h2 style={SECTION_TITLE}>Our Information</h2>
        <p style={INFO_LINE}>
          <strong>Email:</strong> support@kikar.com
        </p>
        <p style={INFO_LINE}>
          <strong>Phone:</strong> +972 12 345 6789
        </p>
        <p style={INFO_LINE}>
          <strong>Address:</strong> Tel Aviv, Israel
        </p>
      </Notice>
    </div>
  );
};

export default Contact;
