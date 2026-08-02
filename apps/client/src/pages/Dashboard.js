import React, { useState, useEffect } from "react";
import { Button, Spinner } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import { Link, useHistory } from "react-router-dom";
import Avatar from "../Components/Avatar";
import * as usersApi from "../api/users";

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
      <div className="text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  // A signed-in account with no profile row reaches this instead of spinning
  // forever, which is what the old `if (!user.name)` guard did.
  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="alert alert-error">{error || "Profile not found."}</div>
          <Button variant="link" className="dashboard-button" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <Avatar user={user} className="dashboard-avatar" />

        <div className="dashboard-header">
          <h2>{user.name}</h2>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="dashboard-info">
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Address:</strong> {user.address || "Not set"}
          </p>
          <p>
            <strong>Birth Date:</strong>{" "}
            {user.birthDate ? user.birthDate.slice(0, 10) : "Not set"}
          </p>
        </div>

        <Link to="/update-profile" className="dashboard-button update-profile-btn">
          <i className="fas fa-pen-alt"></i> Update Profile
        </Link>

        <div className="w-100 text-center mt-3">
          <Button
            variant="link"
            className="dashboard-button logout-btn"
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i> Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
