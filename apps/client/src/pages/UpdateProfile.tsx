import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "../lib/queryKeys";
import * as usersApi from "../api/users";
import Button from "../Components/ui/Button";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";

const MIN_PASSWORD_LENGTH = 6;

/**
 * The subset of a user row this form reads back to prefill itself. Kept
 * local and permissive for the same reason as AddPost's own comment:
 * `api/users.ts` still returns an untyped row (`getUser` is `Promise<any>`),
 * so this is not the place a shared, stricter `User` type gets invented.
 * Every field optional/nullable to match the `??`/`? :` fallbacks already
 * guarding them below.
 */
interface UpdateProfileUser {
  email?: string;
  name?: string;
  address?: string | null;
  birthDate?: string | null;
}

/** The three text fields this form edits directly. Typed separately from
 * `UpdateProfileUser` above: email is read-only here and password/avatar
 * live in their own state, so this is the shape `setField`'s `keyof` actually
 * needs — the same reasoning SignUp's `EMPTY_FORM` gives for its own form
 * state type. */
interface UpdateProfileFormState {
  name: string;
  address: string;
  birthDate: string;
}

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
// notice on it and keep it off the screen edge on a phone. Same 440px auth
// frame as Signin/SignUp — SignUp is this form's direct template.
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

// Below the notice, on the paved ground — same slot Signin/SignUp's FOOTER
// occupies, but a Button rather than a text link, so it centres a flex item
// instead of centring text.
const FOOTER: React.CSSProperties = {
  maxWidth: 440,
  margin: "18px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
};

const SKELETON_FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

// Email, Name, Address, Birth Date, Avatar — the fields visible before the
// profile has loaded (New/Verify Password only ever appear once someone has
// typed into the first one, so they add nothing to a placeholder).
const SKELETON_FIELD_COUNT = 5;

function UpdateProfile() {
  const { currentUser, updatePassword } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const uid = currentUser?.uid;

  // Keyed on the shared profile cache entry — Dashboard and Plaza fetch this
  // exact same row.
  const profileQuery = useQuery<UpdateProfileUser>({
    queryKey: queryKeys.users.detail(uid ?? ""),
    queryFn: () => usersApi.getUser(uid!),
    enabled: Boolean(uid),
  });

  const [form, setForm] = useState<UpdateProfileFormState>({
    name: "",
    address: "",
    birthDate: "",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Seeds the editable form fields from the fetched profile exactly once. A
  // later background refetch of the same cache key (e.g. triggered by
  // revisiting this route) must not silently overwrite whatever the person
  // has already typed, which is why this is gated by a ref instead of just
  // depending on `profileQuery.data` alone.
  const seededRef = useRef(false);
  useEffect(() => {
    if (profileQuery.data && !seededRef.current) {
      seededRef.current = true;
      setEmail(profileQuery.data.email ?? "");
      setForm({
        name: profileQuery.data.name ?? "",
        address: profileQuery.data.address ?? "",
        // The API returns an ISO timestamp; <input type="date"> wants YYYY-MM-DD.
        birthDate: profileQuery.data.birthDate
          ? profileQuery.data.birthDate.slice(0, 10)
          : "",
      });
    }
  }, [profileQuery.data]);

  const isLoading = profileQuery.isLoading;
  const loadErrorMessage =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? String(profileQuery.error)
        : "";
  const error = submitError || loadErrorMessage;

  // Field's onChange prop type is an intersection of all three control
  // element handlers (it can render as input/textarea/select), so the event
  // parameter here has to be the union of their element types to satisfy it —
  // the same shape AddPost's own Field onChange handlers use.
  const setField =
    (field: keyof UpdateProfileFormState) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password && password !== passwordConfirm) {
      setSubmitError("Passwords do not match");
      return;
    }
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      setSubmitError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsSaving(true);
    setSubmitError("");

    try {
      // Non-null: this form only ever renders behind PrivateRoute, which
      // redirects to /signin whenever `currentUser` (and so `uid`) is absent —
      // by the time a submit can fire, it is always set.
      let updatedUser = await usersApi.updateProfile(uid!, {
        name: form.name.trim(),
        address: form.address.trim() || null,
        birthDate: form.birthDate || null,
      });

      if (image) {
        // Returns the full row again, already reflecting the name/address/
        // birthDate change just above — the DB write it read back from
        // committed before this call started.
        updatedUser = await usersApi.uploadAvatar(uid!, image);
      }

      // Last, because a password change can invalidate the session and would
      // otherwise abort the rest of the save.
      if (password) {
        await updatePassword(password);
      }

      // Dashboard and Plaza read this exact cache entry. Without this, the
      // next mount of either (this navigate() included) renders whatever was
      // cached before the save for one paint, until TanStack Query's own
      // background refetch quietly corrects it.
      queryClient.setQueryData(queryKeys.users.detail(uid!), updatedUser);

      navigate("/");
    } catch (err) {
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message`, the same pattern SignUp's catch uses.
      // `+` binds tighter than `||`, so the old fallback here never ran and the
      // message read "undefined" whenever the server sent no body.
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(message || "Failed to update profile");
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
            onChange={(
              event: React.ChangeEvent<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >
            ) =>
              // `Field`'s onChange type is an intersection of all three control
              // handlers (see setField above), so the event here is typed as the
              // union — cast to reach `.files`, which only HTMLInputElement has.
              setImage((event.target as HTMLInputElement).files?.[0] ?? null)
            }
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
        <Button variant="secondary" onClick={() => navigate("/")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default UpdateProfile;
