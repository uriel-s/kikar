import React, { useState } from "react";
import { FaUserPlus, FaUserTimes } from "react-icons/fa";
import Avatar from "./Avatar";

const UserCard = ({ user, isFriend, onFriendChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const changeFriendship = async (action) => {
    setIsLoading(true);
    setError("");
    try {
      await onFriendChange(user.id, action);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <article className="user-card br3 ba b--black-10 mv4 w-100 w-50-m w-33-l mw6 shadow-5 center">
      <main className="pa3 black-80">
        {error && <div className="error-message mb3">{error}</div>}

        <div className="user-card-content">
          {/* 100px is what `.user-card img` gave this. That selector is scoped
              to img, so it stopped matching when the photoless fallback became
              a span — the size has to come from the prop now. */}
          <Avatar user={user} size={100} className="rounded-circle user-img" />

          <div className="user-info">
            <h3 className="f3 fw6 ph0 mh0">{user.name}</h3>

            {/* Email and address are deliberately absent: the API returns them
                only to the account owner, so there is nothing to render here. */}

            {onFriendChange && (
              <div className="mt3">
                {isFriend ? (
                  <button
                    className="unfriend-btn"
                    onClick={() => changeFriendship("remove")}
                    disabled={isLoading}
                    title="Remove friend"
                  >
                    {isLoading ? (
                      "Removing..."
                    ) : (
                      <>
                        <FaUserTimes /> Unfriend
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    className="add-friend-btn"
                    onClick={() => changeFriendship("add")}
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
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </article>
  );
};

export default UserCard;
