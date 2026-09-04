import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../Components/ui/Button";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";

// Field's own error type, restated here: this message answers for the whole
// form rather than one control, the same reasoning PostCard's comment-form
// ERROR gives for doing the same thing.
const ERROR: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-like)",
};

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notice on it and keep it off the screen edge on a phone.
const FRAME: React.CSSProperties = {
  maxWidth: 440,
  margin: "48px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
};

const TITLE: React.CSSProperties = {
  margin: "0 0 20px",
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 1.2,
};

const FIELD_GAP: React.CSSProperties = { marginTop: 14 };

const ACTIONS: React.CSSProperties = { marginTop: 20 };

// ink/muted, not paper-ink/paper-muted: this line sits on the paved ground
// below the notice, not on paper, the same reasoning Footer.js gives for its
// own text.
const FOOTER: React.CSSProperties = {
  maxWidth: 440,
  margin: "18px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
  textAlign: "center",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-muted)",
};

// Explicit, not inherited: Tailwind's preflight resets `a { color: inherit;
// text-decoration: inherit }`, and now that Bootstrap (which used to give
// every bare <a> a colour and an underline) is gone, a Link with no style of
// its own is indistinguishable from the surrounding sentence — exactly the
// one line on this page whose whole job is being noticed.
const FOOTER_LINK: React.CSSProperties = {
  color: "var(--color-accent)",
  fontWeight: 600,
  textDecoration: "underline",
};

function Signin() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Firebase signin and link to dashboard
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      // Both refs are attached to Fields rendered unconditionally below, so
      // they are never null by the time a submit can fire.
      await login(emailRef.current!.value, passwordRef.current!.value);
      navigate("/"); // Redirect to homepage or dashboard
    } catch {
      setError("Failed to login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/*
       * `as="form"` puts the keyline rim on the form itself, the way AddPost's
       * composer does, and — unlike the old markup — actually wires the
       * submit up: there was no <form> element here before, just a bare
       * <input type="submit"> whose onClick called handleSubmit by hand, so
       * pressing Enter in a field did nothing. A real <form onSubmit> fixes
       * that for free.
       */}
      <Notice as="form" onSubmit={handleSubmit} style={FRAME}>
        <h1 style={TITLE}>Sign in</h1>

        {error ? (
          <p role="alert" style={ERROR}>
            {error}
          </p>
        ) : null}

        <Field ref={emailRef} label="Email" type="email" name="email-address" />

        <div style={FIELD_GAP}>
          <Field ref={passwordRef} label="Password" type="password" name="password" />
        </div>

        <div style={ACTIONS}>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </Notice>

      <p style={FOOTER}>
        Need an account?{" "}
        <Link to="/signup" style={FOOTER_LINK}>
          Sign Up
        </Link>
      </p>
    </div>
  );
}

export default Signin;
