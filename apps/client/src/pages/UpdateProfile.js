import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHistory } from "react-router-dom";
import * as usersApi from "../api/users";
import Button from "../Components/ui/Button";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";

const MIN_PASSWORD_LENGTH = 6;

// Field's own error type, restated here: this message answers for the whole
// form rather than one control, the same reasoning PostCard's comment-form
// ERROR gives for doing the same thing.
const ERROR = {
  margin: "0 0 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-like)",
};

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notice on it and keep it off the screen edge on a phone. Same 440px auth
// frame as Signin/SignUp — SignUp is this form's direct template.
const FRAME = {
  maxWidth: 440,
  margin: "48px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
};

const TITLE = {
  margin: "0 0 20px",
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 1.2,
};

const FIELD_GAP = { marginTop: 14 };

const ACTIONS = { marginTop: 20 };

// Below the notice, on the paved ground — same slot Signin/SignUp's FOOTER
// occupies, but a Button rather than a text link, so it centres a flex item
// instead of centring text.
const FOOTER = {
  maxWidth: 440,
  margin: "18px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
};

const SKELETON_FIELD = { display: "flex", flexDirection: "column", gap: 6 };

// Email, Name, Address, Birth Date, Avatar — the fields visible before the
// profile has loaded (New/Verify Password only ever appear once someone has
// typed into the first one, so they add nothing to a placeholder).
const SKELETON_FIELD_COUNT = 5;

function UpdateProfile() {
  const { currentUser, updatePassword } = useAuth();
  const history = useHistory();

  const [form, setForm] = useState({ name: "", address: "", birthDate: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    usersApi
      .getUser(uid)
      .then((user) => {
        if (cancelled) return;
        setEmail(user.email ?? "");
        setForm({
          name: user.name ?? "",
          address: user.address ?? "",
          // The API returns an ISO timestamp; <input type="date"> wants YYYY-MM-DD.
          birthDate: user.birthDate ? user.birthDate.slice(0, 10) : "",
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password && password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await usersApi.updateProfile(uid, {
        name: form.name.trim(),
        address: form.address.trim() || null,
        birthDate: form.birthDate || null,
      });

      if (image) {
        await usersApi.uploadAvatar(uid, image);
      }

      // Last, because a password change can invalidate the session and would
      // otherwise abort the rest of the save.
      if (password) {
        await updatePassword(password);
      }

      history.push("/");
    } catch (err) {
      // `+` binds tighter than `||`, so the old fallback here never ran and the
      // message read "undefined" whenever the server sent no body.
      setError(err.message || "Failed to update profile");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div aria-busy="true">
        <Notice as="div" style={FRAME}>
          <Skeleton width="55%" height={22} style={{ marginBottom: 20 }} />

          {Array.from({ length: SKELETON_FIELD_COUNT }).map((_, index) => (
            <div
              key={index}
              style={{ ...SKELETON_FIELD, ...(index > 0 ? FIELD_GAP : null) }}
            >
              <Skeleton width="30%" height={10} />
              <Skeleton height={40} />
            </div>
          ))}
        </Notice>
      </div>
    );
  }

  return (
    <div>
      {/*
       * `as="form"` puts the keyline rim on the form itself, the way
       * SignUp's notice-as-form does — the whole notice IS the form.
       */}
      <Notice as="form" onSubmit={handleSubmit} style={FRAME}>
        <h1 style={TITLE}>Update Profile</h1>

        {error ? (
          <p role="alert" style={ERROR}>
            {error}
          </p>
        ) : null}

        {/* Changing an email address means re-verifying it through Firebase,
            which this form does not do, so it is read-only. */}
        <Field
          label="Email"
          type="email"
          value={email}
          readOnly
          title="Email cannot be changed here"
        />

        <div style={FIELD_GAP}>
          <Field
            label="Name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={setField("name")}
            required
          />
        </div>

        <div style={FIELD_GAP}>
          <Field
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep the same"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {password && (
          <div style={FIELD_GAP}>
            <Field
              label="Verify New Password"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
            />
          </div>
        )}

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

        <div style={FIELD_GAP}>
          <Field
            label="Avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          />
        </div>

        <div style={ACTIONS}>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Updating…" : "Update"}
          </Button>
        </div>
      </Notice>

      {/* `secondary` is ground-safe — its --color-muted border measures
          4.62:1 by day and 5.69:1 at night on the paved ground — and this
          button stands on the ground below the notice, not on paper, the
          same slot Signin/SignUp's footer link occupies. See the header of
          Components/ui/Button.js. */}
      <div style={FOOTER}>
        <Button variant="secondary" onClick={() => history.push("/")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default UpdateProfile;
