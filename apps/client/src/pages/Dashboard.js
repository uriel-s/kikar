import React, { useState, useEffect } from "react";
import { Button, Spinner } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import { Link, useHistory } from "react-router-dom";
import axios from "axios";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

export default function Dashboard() {
  const [error, setError] = useState("");
  const { currentUser, logout } = useAuth();
  const [user, setUser] = useState({});
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);
  const history = useHistory();

  async function handleLogout() {
    setError("");
    try {
      await logout();
      history.push("/signin");
    } catch {
      setError("Failed to log out");
    }
  }

  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;

    const getUser = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
        const res = await axios.get(`${apiUrl}/users/${currentUser.uid}`);
        setUser(res.data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    getUser();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;

    const fetchImageUrl = async () => {
      try {
        const storage = getStorage();
        const profilePictureRef = ref(storage, `profile_pictures/${currentUser.uid}`);
        const url = await getDownloadURL(profilePictureRef);
        setImageUrl(url);
      } catch (error) {
        console.error("Error getting download URL:", error.message);
        setImageError(true);
        setImageUrl("https://www.gravatar.com/avatar/?d=mp&s=100");
      }
    };
    fetchImageUrl();
  }, [currentUser]);

  if (!user.name) {
    return (
      <div className="text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <img src={imageUrl} alt="Avatar" className="dashboard-avatar" />
        {imageError && <div className="error-message">Failed to load profile image</div>}
        <div className="dashboard-header">
          <h2>{user.name || "No name"}</h2>
        </div>
        <div className="dashboard-info">
          <p>
            <strong>Email:</strong> {user.email || "No email"}
          </p>
          <p>
            <strong>Address:</strong> {user.address || "No address"}
          </p>
          <p>
            <strong>Birth Date:</strong> {user.birthDate || "No birthdate"}
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
