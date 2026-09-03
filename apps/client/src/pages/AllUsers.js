import React, { useState, useEffect, useCallback, useMemo } from "react";
import UserCard from "../Components/UserCard";
import Button from "../Components/ui/Button";
import EmptyState from "../Components/ui/EmptyState";
import Field from "../Components/ui/Field";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { useNarrowerThan } from "../lib/useMediaQuery";
import * as usersApi from "../api/users";

// This page has no ancestor that caps its width the way Plaza caps the feed's
// at 1100 — off-plaza routes get only WavesBackground's paved floor and
// whatever margin/padding the page states itself. 1100 restated here to match
// the same scale the rest of the app already reads at.
const FRAME = { maxWidth: 1100, margin: "32px auto 0", padding: "0 20px 40px" };

const CARD_WIDTH = 240;
const GAP = 24;

/*
 * Breakpoints derived from the grid's own math, the way PostsPage derives
 * THREE_COLUMNS/TWO_COLUMNS from COLUMN_WIDTH and GAP: a row of n cards needs
 * n * CARD_WIDTH + (n-1) * GAP, so the step to n falls exactly at that width
 * rather than at a number chosen by eye.
 */
const FOUR_COLUMNS = 4 * CARD_WIDTH + 3 * GAP; // 1032
const THREE_COLUMNS = 3 * CARD_WIDTH + 2 * GAP; // 768
const TWO_COLUMNS = 2 * CARD_WIDTH + GAP; // 504

/**
 * How many columns fit. Unlike PostsPage's wall, a person card holds a fixed
 * amount (a face, a name, a button) rather than variable-length prose, so
 * there is no masonry to pack — one flat grid, in plain reading order, is
 * enough.
 */
const useColumnCount = () => {
  const belowFour = useNarrowerThan(FOUR_COLUMNS);
  const belowThree = useNarrowerThan(THREE_COLUMNS);
  const belowTwo = useNarrowerThan(TWO_COLUMNS);

  if (belowTwo) return 1;
  if (belowThree) return 2;
  return belowFour ? 3 : 4;
};

// `minmax(0, CARD_WIDTH)` rather than a bare CARD_WIDTH, for the same reason
// PostsPage's wall does: between two breakpoints the exact column count can
// still be a hair wider than the viewport, and the tracks have to be allowed
// to give rather than force a scrollbar.
const gridStyle = (count) => ({
  display: "grid",
  gridTemplateColumns: `repeat(${count}, minmax(0, ${CARD_WIDTH}px))`,
  gap: GAP,
  justifyContent: "center",
  margin: "28px 0 0",
  padding: 0,
  listStyle: "none",
});

const FILTER_FIELD = { maxWidth: 240 };

/*
 * Ink, not --color-like: this message sits directly on the paved ground, not
 * on a notice, and --color-like is measured for paper — 3.88:1 on the ground
 * by day and 2.64:1 at night, both under the 4.5:1 AA wants of 14px body
 * copy. Ink measures 10.5-13.4:1 there. Same reasoning as PostsPage's own
 * top-level error; Field's paper-context error is the one place --color-like
 * is correct, because a Field's error sits inside paper.
 */
const ERROR = {
  margin: "0 0 20px",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--color-ink)",
};

const SKELETON_CARD = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
};

// Two rows of placeholders, the same count PostsPage uses for the same
// reason: enough to look like a wall being put up, not a wall with one
// notice pinned to it.
const SKELETON_ROWS = 2;

/**
 * A notice about no one in particular yet. No `author`, so it takes no one's
 * hue — a placeholder tinted in somebody's colour would be a promise about
 * whose card this is, and the whole point of this state is that we do not
 * know yet.
 */
const UserCardSkeleton = () => (
  <Notice as="li" padding="26px 20px">
    <div style={SKELETON_CARD}>
      <Skeleton variant="circle" width={84} />
      <Skeleton width="70%" height={14} />
      <Skeleton width={112} height={34} />
    </div>
  </Notice>
);

const EMPTY_COPY = {
  all: {
    title: "No one here yet",
    description: "There is no one to show. Check back once more people have joined.",
  },
  friends: {
    title: "No friends yet",
    description:
      "You have not added anyone as a friend. Switch the filter to non-friends to find someone to add.",
  },
  "non-friends": {
    title: "Everyone is already a friend",
    description:
      "There is no one left to add — you are already friends with everyone here.",
  },
};

const AllUsers = () => {
  const [users, setUsers] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const [nextCursor, setNextCursor] = useState(null);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();
  const columnCount = useColumnCount();

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

  const skeletons = Array.from(
    { length: columnCount * SKELETON_ROWS },
    (_, index) => index
  );

  return (
    <div style={FRAME}>
      {/* role="alert" rather than the old .alert div, because this appears
          after a request fails instead of being on screen all along. */}
      {error && (
        <p role="alert" style={ERROR}>
          {error}
        </p>
      )}

      <Field
        as="select"
        label="Filter users by"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        style={FILTER_FIELD}
      >
        <option value="all">All</option>
        <option value="friends">Friends</option>
        <option value="non-friends">Non-friends</option>
      </Field>

      {/* aria-busy on the region, because Skeleton is aria-hidden by design
          and the region is therefore the only thing left that can say it is
          loading. A screen reader announcing a grid of grey shapes is worse
          than silence. */}
      <div aria-busy={isLoading}>
        {isLoading ? (
          <ul style={gridStyle(columnCount)} aria-label="Loading users">
            {skeletons.map((placeholder) => (
              <UserCardSkeleton key={placeholder} />
            ))}
          </ul>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            title={EMPTY_COPY[filter].title}
            description={EMPTY_COPY[filter].description}
          />
        ) : (
          <ul style={gridStyle(columnCount)} aria-label="Users">
            {visibleUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isFriend={friendIds.has(user.id)}
                onFriendChange={handleFriendChange}
              />
            ))}
          </ul>
        )}
      </div>

      {/* `secondary` is safe on the ground — its --color-muted border measures
          4.62:1 by day and 5.69:1 at night — and unsafe on a notice, where the
          same border drops to 2.62:1 in Slate Night. This one stands on the
          ground. See the header of Components/ui/Button.js. */}
      {nextCursor && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 34 }}>
          <Button variant="secondary" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};

export default AllUsers;
