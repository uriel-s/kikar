import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Alert from "react-bootstrap/Alert";
import { Link, useHistory } from "react-router-dom";
import * as usersApi from "../api/users";

const MIN_PASSWORD_LENGTH = 6;

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
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="mt6">
      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <form className="measure" onSubmit={handleSubmit}>
            <fieldset className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0">
                <i className="fas fa-wrench"></i> Update Profile
              </legend>

              {error && <Alert variant="danger">{error}</Alert>}

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email">
                  Email
                </label>
                {/* Changing an email address means re-verifying it through
                    Firebase, which this form does not do, so it is read-only. */}
                <input
                  id="email"
                  className="pa2 input-reset ba w-100 bg-light-gray"
                  type="email"
                  value={email}
                  readOnly
                  title="Email cannot be changed here"
                />
              </div>

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="pa2 input-reset ba w-100"
                  type="text"
                  value={form.name}
                  onChange={setField("name")}
                  required
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">
                  New Password
                </label>
                <input
                  id="password"
                  className="b pa2 input-reset ba w-100"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep the same"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {password && (
                <div className="mv3">
                  <label className="db fw6 lh-copy f6" htmlFor="password-confirm">
                    Verify New Password
                  </label>
                  <input
                    id="password-confirm"
                    className="b pa2 input-reset ba w-100"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                  />
                </div>
              )}

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="address">
                  Address
                </label>
                <input
                  id="address"
                  className="pa2 input-reset ba w-100"
                  type="text"
                  value={form.address}
                  onChange={setField("address")}
                />
              </div>

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="birth-date">
                  Birth Date
                </label>
                <input
                  id="birth-date"
                  className="pa2 input-reset ba w-100"
                  type="date"
                  value={form.birthDate}
                  onChange={setField("birthDate")}
                />
              </div>

              <div className="mb-3 mt3">
                <label className="form-label fw-bold" htmlFor="avatar">
                  Avatar
                </label>
                <input
                  id="avatar"
                  className="form-control"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
              </div>
            </fieldset>

            <div className="text-center">
              <button
                disabled={isSaving}
                className="btn btn-primary ph3 pv2 grow pointer f6 dib"
                type="submit"
              >
                {isSaving ? "Updating..." : "Update"}
              </button>
            </div>
          </form>
        </main>
      </article>

      <div className="d-flex justify-content-center mt-3">
        <Link to="/" className="btn btn-outline-secondary btn-lg">
          Cancel
        </Link>
      </div>
    </div>
  );
}

export default UpdateProfile;
