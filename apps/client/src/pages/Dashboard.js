import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHistory } from "react-router-dom";
import Avatar from "../Components/Avatar";
import Button from "../Components/ui/Button";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";
import * as usersApi from "../api/users";

// No background/max-width fight with the ground here — WavesBackground paves
// the floor behind this whole route, so the frame only has to centre the
// notice on it and keep it off the screen edge on a phone. Same 440px auth
// frame as Signin/SignUp: this is one person's own summary, not a wall of
// content.
const FRAME = {
  maxWidth: 440,
  margin: "48px auto 60px",
  padding: "0 20px",
  boxSizing: "border-box",
};

// Centres the avatar/name/rows/buttons as a column. Flexbox, not the old
// `.dashboard-card { text-align: center }` trick — that only worked because
// the legacy avatar was a bare inline <img>; the shared Avatar component
// needs a real centring context.
const CARD = { display: "flex", flexDirection: "column", alignItems: "center" };

const NAME = {
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
const ERROR = {
  margin: "12px 0 0",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
  color: "var(--color-like)",
};

const INFO_LIST = {
  width: "100%",
  marginTop: 24,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  textAlign: "left",
};

// Small/uppercase/tracked, the same shape PostCard's ACTION_LABEL and
// AUTHOR_NAME already use for a caption sitting above a value.
const LABEL = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-paper-muted)",
};

const VALUE = {
  margin: "3px 0 0",
  fontSize: 15,
  lineHeight: 1.4,
  color: "inherit",
};

// Stretches its Button children to the card's full width — a column of two
// full-width actions reads better under a centred profile than two pill
// buttons floating side by side.
const ACTIONS = {
  width: "100%",
  marginTop: 26,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const SKELETON_AVATAR_WRAP = { display: "flex", justifyContent: "center" };
const SKELETON_LINES = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 24,
  width: "100%",
};

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const history = useHistory();

  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    // One request. The avatar URL arrives on the user, so there is no second
    // round trip to Firebase Storage to resolve it.
    usersApi
      .getUser(uid)
      .then((loaded) => {
        if (!cancelled) setUser(loaded);
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

  async function handleLogout() {
    setError("");
    try {
      await logout();
      history.push("/signin");
    } catch {
      setError("Failed to log out");
    }
  }

  if (isLoading) {
    return (
      <div>
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
            <Button variant="primary" onClick={() => history.push("/update-profile")}>
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
