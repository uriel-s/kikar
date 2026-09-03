import React from "react";
import { Route, Redirect } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Explicit, not inherited: on every route but the plaza itself,
// WavesBackground paints the paved ground and ink reads fine on it, but the
// plaza route deliberately opts out of that background (Plaza.js paints its
// own once signed in) — so this line, which renders for one frame before the
// Redirect below fires, would otherwise sit on the bare, unpainted <body>.
// index.css used to cover that gap by hard-coding a dark body and a light `p`
// everywhere; stated here instead so this line does not depend on it.
const MESSAGE = {
  textAlign: "center",
  fontFamily: "var(--font-body)",
  color: "var(--color-ink)",
};

export default function PrivateRoute({ component: Component, ...rest }) {
  const { currentUser } = useAuth();

  return (
    <Route
      {...rest}
      render={(props) =>
        currentUser ? (
          <Component {...props} />
        ) : (
          <>
            <p style={MESSAGE}>You need to sign in to view this page.</p>
            <Redirect to="/signin" />
          </>
        )
      }
    />
  );
}
