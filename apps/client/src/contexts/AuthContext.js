import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { auth } from "../firebase";

const AuthContext = React.createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signup = useCallback(
    (email, password) => auth.createUserWithEmailAndPassword(email, password),
    []
  );

  const login = useCallback(
    (email, password) => auth.signInWithEmailAndPassword(email, password),
    []
  );

  const logout = useCallback(() => auth.signOut(), []);

  const updatePassword = useCallback((password) => {
    if (!auth.currentUser) {
      return Promise.reject(new Error("Not signed in"));
    }
    // Read from auth.currentUser rather than the state snapshot: the snapshot is
    // captured at render time and can be stale by the time this runs.
    return auth.currentUser.updatePassword(password);
  }, []);

  useEffect(
    () =>
      auth.onAuthStateChanged((user) => {
        setCurrentUser(user);
        setLoading(false);
      }),
    []
  );

  const value = useMemo(
    () => ({ currentUser, login, signup, logout, updatePassword }),
    [currentUser, login, signup, logout, updatePassword]
  );

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
