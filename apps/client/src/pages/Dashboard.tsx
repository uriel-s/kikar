import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "../lib/queryKeys";
import Avatar from "../Components/Avatar";
import Button from "../Components/ui/Button";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";
import * as usersApi from "../api/users";

/**
 * The user shape this screen draws — the same fields Avatar's own
 * `AvatarUser` accepts, plus the profile fields the info list reads. Not
 * imported from Avatar.tsx because it is not exported there; kept local and
 * permissive for the same reason as AddPost's own comment: `api/users.ts`
 * still returns an untyped row (`getUser` is `Promise<any>`), so this is not
 * the place a shared, stricter `User` type gets invented. `id` is required —
 * every profile this screen ever renders came back from `getUser(uid)` for a
 * real, signed-in account — while the display fields stay optional/nullable
 * to match the `||`/`? :` fallbacks already guarding them below.
 */
interface DashboardUser {
  id: string;
  name?: string;
  email?: string;
  address?: string | null;
  birthDate?: string | null;
  avatarUrl?: string | null;
}

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notice on it and keep it off the screen edge on a phone. Same 440px auth
// frame as Signin/SignUp: this is one person's own summary, not a wall of
// content.
const FRAME: React.CSSProperties = {
  maxWidth: 440,
  margin: "48px auto 60px",
  padding: "0 20px",
  boxSizing: "border-box",
};

// Centres the avatar/name/rows/buttons as a column. Flexbox, not the old
// `.dashboard-card { text-align: center }` trick — that only worked because
// the legacy avatar was a bare inline <img>; the shared Avatar component
// needs a real centring context.
const CARD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const NAME: React.CSSProperties = {
  margin: "16px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 22,
  lineHeight: 1.2,
  textAlign: "center",
  // Not load-bearing against index.css's bare `p { color }` — this is an
  // <h1>, which that rule does not touch — but stated explicitly anyway so
  // it does not silently depend on Notice's SURFACE colour being inherited.
  color: "inherit",
};

// Field's own error type, restated here: this message answers for the whole
// card rather than one control, the same reasoning PostCard's comment-form
// ERROR gives for doing the same thing. Paper context (inside the Notice),
// so --color-like, not --color-ink.
const ERROR: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
  color: "var(--color-like)",
};

const INFO_LIST: React.CSSProperties = {
  width: "100%",
  marginTop: 24,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  textAlign: "left",
};

// Small/uppercase/tracked, the same shape PostCard's ACTION_LABEL and
// AUTHOR_NAME already use for a caption sitting above a value.
const LABEL: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-paper-muted)",
};

const VALUE: React.CSSProperties = {
  margin: "3px 0 0",
  fontSize: 15,
  lineHeight: 1.4,
  color: "inherit",
};

// Stretches its Button children to the card's full width — a column of two
// full-width actions reads better under a centred profile than two pill
// buttons floating side by side.
const ACTIONS: React.CSSProperties = {
  width: "100%",
  marginTop: 26,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const SKELETON_AVATAR_WRAP: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};
const SKELETON_LINES: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 24,
  width: "100%",
};

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const uid = currentUser?.uid;

  // One request. The avatar URL arrives on the user, so there is no second
  // round trip to Firebase Storage to resolve it. Keyed on the shared
  // profile cache entry — Plaza and UpdateProfile fetch this exact same row.
  const profileQuery = useQuery<DashboardUser>({
    queryKey: queryKeys.users.detail(uid ?? ""),
    queryFn: () => usersApi.getUser(uid!),
    enabled: Boolean(uid),
  });
  const user = profileQuery.data ?? null;
  const isLoading = profileQuery.isLoading;

  // Logout failure is a local action error, not a fetch error, so it keeps
  // its own state — the query's `error` can't be written to by hand. Both
  // feed the same rendered `error` message the way the old single `error`
  // state used to hold either one, whichever was set most recently.
  const [logoutError, setLogoutError] = useState("");
  const loadErrorMessage =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? String(profileQuery.error)
        : "";
  const error = logoutError || loadErrorMessage;

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/signin");
    } catch {
      setLogoutError("Failed to log out");
    }
  }

  if (isLoading) {
    return (
      <div aria-busy="true">
        <Notice as="div" style={FRAME}>
          <div style={SKELETON_AVATAR_WRAP}>
            <Skeleton variant="circle" width={84} />
          </div>
          <Skeleton width={160} height={18} style={{ margin: "16px auto 0" }} />

          <div style={SKELETON_LINES}>
            <Skeleton width="35%" height={10} />
            <Skeleton width="70%" />
            <Skeleton width="35%" height={10} />
            <Skeleton width="55%" />
            <Skeleton width="35%" height={10} />
            <Skeleton width="45%" />
          </div>
        </Notice>
      </div>
    );
  }

  // A signed-in account with no profile row reaches this instead of spinning
  // forever, which is what the old `if (!user.name)` guard did.
  if (!user) {
    return (
      <div>
        <Notice as="div" style={FRAME}>
          <div style={CARD}>
            <p role="alert" style={ERROR}>
              {error || "Profile not found."}
            </p>

            <div style={ACTIONS}>
              <Button variant="ghost" onClick={handleLogout}>
                Log Out
              </Button>
            </div>
          </div>
        </Notice>
      </div>
    );
  }

  return (
    <div>
      <Notice as="div" style={FRAME}>
        <div style={CARD}>
          <Avatar user={user} size={84} />

          <h1 style={NAME}>{user.name}</h1>

          {error ? (
            <p role="alert" style={ERROR}>
              {error}
            </p>
          ) : null}

          <div style={INFO_LIST}>
            <div>
              <p style={LABEL}>Email</p>
              <p style={VALUE}>{user.email}</p>
            </div>

            <div>
              <p style={LABEL}>Address</p>
              <p style={VALUE}>{user.address || "Not set"}</p>
            </div>

            <div>
              <p style={LABEL}>Birth Date</p>
              <p style={VALUE}>
                {user.birthDate ? user.birthDate.slice(0, 10) : "Not set"}
              </p>
            </div>
          </div>

          <div style={ACTIONS}>
            <Button variant="primary" onClick={() => navigate("/update-profile")}>
              Update Profile
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              Log Out
            </Button>
          </div>
        </div>
      </Notice>
    </div>
  );
}
