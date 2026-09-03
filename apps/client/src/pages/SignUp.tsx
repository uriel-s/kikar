import React, { useState } from "react";
import { Link, useHistory } from "../lib/router";
import { useAuth } from "../contexts/AuthContext";
import { validEmail } from "../Regex";
import * as usersApi from "../api/users";
import { auth } from "../firebase";
import Button from "../Components/ui/Button";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";

const MIN_PASSWORD_LENGTH = 6;

const EMPTY_FORM = {
  email: "",
  password: "",
  passwordConfirm: "",
  name: "",
  address: "",
  birthDate: "",
};

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

function SignUp() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const history = useHistory();

  // Field's onChange prop type is an intersection of all three control
  // element handlers (it can render as input/textarea/select), so the event
  // parameter here has to be the union of their element types to satisfy it —
  // the same shape AddPost's own Field onChange handlers use.
  const setField =
    (field: keyof typeof EMPTY_FORM) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  /** Returns the first problem found, or null when the form is usable. */
  const validate = () => {
    if (!validEmail.test(form.email)) return "Please enter a valid email address";
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      // The old check required 3 characters while telling the user 6.
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (form.password !== form.passwordConfirm) return "Passwords do not match";
    if (!form.name.trim()) return "Name is required";
    return null;
  };

  /**
   * Creates the Firebase account and then the profile row.
   *
   * If the profile call fails the new Firebase account is deleted, because
   * otherwise the user is left able to sign in with no profile — a state the old
   * flow produced silently and had no way to recover from.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    setError("");

    let createdAccount = false;
    try {
      await signup(form.email, form.password);
      createdAccount = true;

      await usersApi.registerProfile({
        name: form.name.trim(),
        address: form.address.trim() || null,
        birthDate: form.birthDate || null,
      });

      history.push("/");
    } catch (err) {
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message`, the same pattern UserCard's catch uses.
      const message = err instanceof Error ? err.message : String(err);
      if (createdAccount) {
        await auth.currentUser?.delete().catch(() => {});
        setError(`Could not create your profile: ${message}. Please try again.`);
      } else {
        setError(message || "Failed to create an account");
      }
      setLoading(false);
    }
  };

  return (
    <div>
      {/*
       * `as="form"` puts the keyline rim on the form itself, the way AddPost's
       * composer does — the whole notice IS the form.
       */}
      <Notice as="form" onSubmit={handleSubmit} style={FRAME}>
        <h1 style={TITLE}>Register</h1>

        {error ? (
          <p role="alert" style={ERROR}>
            {error}
          </p>
        ) : null}

        <Field
          label="* Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={setField("email")}
          required
        />

        <div style={FIELD_GAP}>
          <Field
            label="* Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={setField("password")}
            required
          />
        </div>

        <div style={FIELD_GAP}>
          <Field
            label="* Verify Password"
            type="password"
            autoComplete="new-password"
            value={form.passwordConfirm}
            onChange={setField("passwordConfirm")}
            required
          />
        </div>

        <div style={FIELD_GAP}>
          <Field
            label="* Name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={setField("name")}
            required
          />
        </div>

        <div style={FIELD_GAP}>
          <Field
            label="Address"
            type="text"
            autoComplete="street-address"
            value={form.address}
            onChange={setField("address")}
          />
        </div>

        <div style={FIELD_GAP}>
          <Field
            label="Birth Date"
            type="date"
            value={form.birthDate}
            onChange={setField("birthDate")}
          />
        </div>

        <div style={ACTIONS}>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Creating account…" : "Register"}
          </Button>
        </div>
      </Notice>

      <p style={FOOTER}>
        Already have an account?{" "}
        <Link to="/signin" style={FOOTER_LINK}>
          Log In
        </Link>
      </p>
    </div>
  );
}

export default SignUp;
