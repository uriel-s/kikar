// UserCard.js
import React, { useState, useEffect } from "react";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { FaUserPlus, FaUserTimes } from "react-icons/fa";

const UserCard = ({ user, isFriend, onFriendChange }) => {
  const [imageUrl, setImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchImageUrl = async () => {
      try {
        const storage = getStorage();
        const profilePictureRef = ref(storage, `profile_pictures/${user.id}`);
        const url = await getDownloadURL(profilePictureRef);
        setImageUrl(url);
      } catch (error) {
        if (error.code === "storage/object-not-found") {
          setImageUrl(null);
        } else {
          console.error("Error getting profile picture:", error);
          setError("Failed to load profile picture");
        }
      }
    };

    fetchImageUrl();
  }, [user.id]);

  const handleAddFriend = async () => {
    setIsLoading(true);
    setError("");
    try {
      await onFriendChange(user.id, "add");
    } catch (error) {
      setError("Failed to add friend. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfriend = async () => {
    setIsLoading(true);
    setError("");
    try {
      await onFriendChange(user.id, "remove");
    } catch (error) {
      setError("Failed to remove friend. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const defaultImageUrl = "https://www.gravatar.com/avatar/?d=mp&s=100";

  return (
    <article className="user-card br3 ba b--black-10 mv4 w-100 w-50-m w-33-l mw6 shadow-5 center">
      <main className="pa3 black-80">
        {error && <div className="error-message mb3">{error}</div>}
        <div className="measure">
          <fieldset id="sign_up" className="ba b--transparent ph0 mh0">
            <div className="user-card-content">
              <img
                src={imageUrl || defaultImageUrl}
                alt="Avatar"
                className="rounded-circle user-img"
              />
              <div className="user-info">
                <legend className="f3 fw6 ph0 mh0">{user.name}</legend>
                <div className="mt2">
                  <strong>Email:</strong> {user.email}
                </div>
                {user.address?.trim() && (
                  <div className="mt2">
                    <strong>Address:</strong> {user.address}
                  </div>
                )}

                <div className="mt3">
                  {!isFriend ? (
                    <button
                      className="add-friend-btn"
                      onClick={handleAddFriend}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        "Adding..."
                      ) : (
                        <>
                          <FaUserPlus /> Add Friend
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      className="unfriend-btn"
                      onClick={handleUnfriend}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        "Removing..."
                      ) : (
                        <>
                          <FaUserTimes />{" "}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </main>
    </article>
  );
};

export default UserCard;
