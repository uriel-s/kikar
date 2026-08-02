import React, { useState } from "react";

const FALLBACK = "https://www.gravatar.com/avatar/?d=mp&s=100";

/**
 * Renders a user's avatar from the URL the API already returned.
 *
 * Dashboard, PostCard, and UserCard each used to call the Firebase Storage SDK
 * directly and resolve a download URL per render — a network round trip per
 * avatar per component, plus a thrown-and-caught error for every user who had
 * never uploaded one. The server stores the URL on the user row now, so there
 * is nothing to look up.
 */
const Avatar = ({ user, className = "", alt }) => {
  const [failed, setFailed] = useState(false);
  const src = !failed && user?.avatarUrl ? user.avatarUrl : FALLBACK;

  return (
    <img
      src={src}
      alt={alt ?? `${user?.name ?? "User"}'s avatar`}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;
