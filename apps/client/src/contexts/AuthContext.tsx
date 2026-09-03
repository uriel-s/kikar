import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import firebase from "firebase/compat/app";
import { auth } from "../firebase";

/** The `{ currentUser, login, signup, logout, updatePassword }` shape every
 * consumer of `useAuth()` receives. */
interface AuthContextValue {
  currentUser: firebase.User | null;
  login: (email: string, password: string) => Promise<firebase.auth.UserCredential>;
  signup: (email: string, password: string) => Promise<firebase.auth.UserCredential>;
  logout: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = useCallback(
    (email: string, password: string) =>
      auth.createUserWithEmailAndPassword(email, password),
    []
  );

  const login = useCallback(
    (email: string, password: string) => auth.signInWithEmailAndPassword(email, password),
    []
  );

  const logout = useCallback(() => auth.signOut(), []);

  const updatePassword = useCallback((password: string) => {
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

  return (
    <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
  );
}
