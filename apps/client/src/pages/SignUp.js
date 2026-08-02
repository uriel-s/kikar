import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Alert from "react-bootstrap/Alert";
import { Link, useHistory } from "react-router-dom";
import { validEmail } from "../Regex";
import * as usersApi from "../api/users";
import { auth } from "../firebase";

const MIN_PASSWORD_LENGTH = 6;

const EMPTY_FORM = {
  email: "",
  password: "",
  passwordConfirm: "",
  name: "",
  address: "",
  birthDate: "",
};

function SignUp() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const history = useHistory();

  const setField = (field) => (event) =>
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
  const handleSubmit = async (event) => {
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
      if (createdAccount) {
        await auth.currentUser?.delete().catch(() => {});
        setError(`Could not create your profile: ${err.message}. Please try again.`);
      } else {
        setError(err.message || "Failed to create an account");
      }
      setLoading(false);
    }
  };

  return (
    <div className="mt6">
      <article className="grow br3 ba b--black-10 mv4 w-100 w-50-m w-25-l mw6 shadow-5 center">
        <main className="pa4 black-80">
          <form className="measure" onSubmit={handleSubmit}>
            <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
              <legend className="f1 fw6 ph0 mh0">
                Register <i className="fas fa-user-plus"></i>
              </legend>

              {error && <Alert variant="danger">{error}</Alert>}

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="email">
                  * Email
                </label>
                <input
                  id="email"
                  className="pa2 input-reset ba w-100"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={setField("email")}
                  required
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password">
                  * Password
                </label>
                <input
                  id="password"
                  className="pa2 input-reset ba w-100"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={setField("password")}
                  required
                />
              </div>

              <div className="mv3">
                <label className="db fw6 lh-copy f6" htmlFor="password-confirm">
                  * Verify Password
                </label>
                <input
                  id="password-confirm"
                  className="pa2 input-reset ba w-100"
                  type="password"
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={setField("passwordConfirm")}
                  required
                />
              </div>

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="name">
                  * Name
                </label>
                <input
                  id="name"
                  className="pa2 input-reset ba w-100"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={setField("name")}
                  required
                />
              </div>

              <div className="mt3">
                <label className="db fw6 lh-copy f6" htmlFor="address">
                  Address
                </label>
                <input
                  id="address"
                  className="pa2 input-reset ba w-100"
                  type="text"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={setField("address")}
                />
              </div>

              <div className="mv3">
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
            </fieldset>

            <button
              disabled={loading}
              className="b ph3 pv2 input-reset ba b--black bg-transparent grow pointer f6 dib"
              type="submit"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>
        </main>
      </article>

      <div className="w-100 text-center mt-2 grow">
        Already have an account? <Link to="/signin">Log In</Link>
      </div>
    </div>
  );
}

export default SignUp;
