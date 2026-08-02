import React, { useState, useEffect, useCallback, useMemo } from "react";
import UserCard from "../Components/UserCard";
import { useAuth } from "../contexts/AuthContext";
import * as usersApi from "../api/users";

const AllUsers = () => {
  const [users, setUsers] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const [nextCursor, setNextCursor] = useState(null);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  const uid = currentUser?.uid;

  const loadData = useCallback(async () => {
    if (!uid) return;

    setIsLoading(true);
    setError("");
    try {
      const [usersPage, friends] = await Promise.all([
        usersApi.listUsers(),
        usersApi.listFriends(uid),
      ]);

      setUsers(usersPage.users);
      setNextCursor(usersPage.nextCursor);
      // The API returns friend objects now, not bare ids.
      setFriendIds(new Set(friends.map((friend) => friend.id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  // The filter is applied in memory, so changing it no longer refetches
  // everything the way the old effect's [filter] dependency did.
  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      const page = await usersApi.listUsers({ cursor: nextCursor });
      setUsers((current) => [...current, ...page.users]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFriendChange = async (friendId, action) => {
    const previous = friendIds;

    setFriendIds((current) => {
      const next = new Set(current);
      if (action === "add") next.add(friendId);
      else next.delete(friendId);
      return next;
    });

    try {
      if (action === "add") {
        await usersApi.addFriend(uid, friendId);
      } else {
        await usersApi.removeFriend(uid, friendId);
      }
    } catch (err) {
      setFriendIds(previous);
      setError(err.message);
      throw err;
    }
  };

  const visibleUsers = useMemo(() => {
    const others = users.filter((user) => user.id !== uid);
    if (filter === "friends") return others.filter((user) => friendIds.has(user.id));
    if (filter === "non-friends") return others.filter((user) => !friendIds.has(user.id));
    return others;
  }, [users, filter, friendIds, uid]);

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="mt6">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-container">
        <label htmlFor="user-filter" className="filter-label">
          Filter users by:
        </label>
        <select
          id="user-filter"
          className="filter-select"
          onChange={(event) => setFilter(event.target.value)}
          value={filter}
        >
          <option value="all">All</option>
          <option value="friends">Friends</option>
          <option value="non-friends">Non-friends</option>
        </select>
      </div>

      <div className="user-card-container">
        {visibleUsers.length === 0 ? (
          <p className="no-results">No users to show.</p>
        ) : (
          visibleUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isFriend={friendIds.has(user.id)}
              onFriendChange={handleFriendChange}
            />
          ))
        )}
      </div>

      {nextCursor && (
        <button className="load-more-btn" onClick={loadMore}>
          Load more
        </button>
      )}
    </div>
  );
};

export default AllUsers;
