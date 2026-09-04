import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Explicit, not inherited: on every route but the plaza itself,
// WavesBackground paints the paved ground and ink reads fine on it, but the
// plaza route deliberately opts out of that background (Plaza.js paints its
// own once signed in) — so this line, which renders for one frame before the
// Navigate below fires, would otherwise sit on the bare, unpainted <body>.
// index.css used to cover that gap by hard-coding a dark body and a light `p`
// everywhere; stated here instead so this line does not depend on it.
const MESSAGE: React.CSSProperties = {
  textAlign: "center",
  fontFamily: "var(--font-body)",
  color: "var(--color-ink)",
};

interface PrivateRouteProps {
  children: React.ReactNode;
}

// v7's route guard is a plain wrapper component, not a custom <Route> — this
// app's route list is flat (10 routes, no nested sub-trees), so a children-in/
// children-or-<Navigate>-out wrapper covers it without inventing a parent
// layout route and an <Outlet> this app has no other use for.
export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <>
        <p style={MESSAGE}>You need to sign in to view this page.</p>
        <Navigate to="/signin" replace />
      </>
    );
  }

  return <>{children}</>;
}
