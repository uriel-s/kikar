import React, { useState, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import PostCard from "../Components/PostCard";
import AddPostForm from "../Components/AddPost";
import PresenceStrip from "../Components/PresenceStrip";
import Button from "../Components/ui/Button";
import EmptyState from "../Components/ui/EmptyState";
import Notice from "../Components/ui/Notice";
import Skeleton from "../Components/ui/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { useNarrowerThan } from "../lib/useMediaQuery";
import { ApiRequestError } from "../lib/apiClient";
import { queryKeys } from "../lib/queryKeys";
import * as postsApi from "../api/posts";

/*
 * The wall's own breakpoints, and deliberately NOT the header's 900/560: the
 * number of columns is decided by whether the columns still fit, not by
 * anything the header does. A notice is 346px wide with 30px between columns,
 * so three of them are 1098 — the 1100 column Plaza hands down — and two are
 * 722. Below that there is room for one.
 */
const THREE_COLUMNS = 1100;
const TWO_COLUMNS = 720;

const COLUMN_WIDTH = 346;
const GAP = 30;

// Two rows of placeholders per column: enough to look like a wall being put up
// rather than like a wall with one notice on it.
const SKELETONS_PER_COLUMN = 2;

const COLUMN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  // The column owns the vertical gap. PostCard sets no margin of its own, for
  // exactly this reason — a notice that spaced itself would space itself
  // differently here and in a search result.
  gap: GAP,
  margin: 0,
  padding: 0,
  listStyle: "none",
};

/*
 * `minmax(0, 346px)` rather than a fixed width: the column count changes at
 * 720, but between 720 and 754 two 346px columns plus the ground's padding are
 * still wider than the screen, so the tracks have to be allowed to give. The
 * max is the design's width and `justifyContent: center` keeps the wall under
 * the composer above it, which is struck from the same vanishing point as the
 * paving.
 */
const wallStyle = (count: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${count}, minmax(0, ${COLUMN_WIDTH}px))`,
  gap: GAP,
  justifyContent: "center",
  // Columns are independent stacks, not rows: without this the shorter column
  // stretches to the height of the tallest and its gap opens up with it.
  alignItems: "start",
});

const REGION: React.CSSProperties = { marginTop: 38 };

const STRIP: React.CSSProperties = { marginTop: 24 };

/*
 * Ink, not --color-like, which is what an error message wants to be and what
 * PostCard uses for its own. That token is measured for paper: on the paved
 * ground it is 3.88:1 by day and 2.64:1 at night, both under the 4.5:1 AA
 * wants of 14px body copy, so the one message on this screen that has to be
 * read would be the hardest thing on it to read. Ink is 10.5:1 and 13.4:1.
 * role="alert" is what actually announces this as a failure; a colour was
 * never doing that job for anyone who could not see it.
 */
const ERROR: React.CSSProperties = {
  margin: "24px 0 0",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--color-ink)",
};

const LOAD_MORE: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 34,
};

const SKELETON_HEAD: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const SKELETON_LINES: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  // A flex child's min-width is auto, so without this the bars refuse to
  // shrink below their own content box and push the disc out of the notice.
  minWidth: 0,
  flexGrow: 1,
};
const SKELETON_BODY: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
  marginTop: 15,
};

/**
 * A notice with nothing in it yet.
 *
 * No `author`, so it takes no one's hue: a placeholder tinted in somebody's
 * colour is a promise about who wrote the post underneath it, and the whole
 * point of this state is that we do not know yet.
 */
const SkeletonNotice = () => (
  <Notice as="li" padding="20px 22px 22px">
    <div style={SKELETON_HEAD}>
      <Skeleton variant="circle" width={40} />
      <div style={SKELETON_LINES}>
        <Skeleton width="55%" />
        <Skeleton width="35%" height={10} />
      </div>
    </div>

    <div style={SKELETON_BODY}>
      <Skeleton />
      <Skeleton width="82%" />
    </div>
  </Notice>
);

/**
 * The partial author shape a post carries — the same fields Avatar's own
 * `AvatarUser` accepts, and structurally the same shape PostCard.tsx's own
 * (non-exported) `PostAuthor` declares locally, for the same reason:
 * `api/posts.ts` still returns an untyped row, so this is not the place a
 * shared, stricter `User` type gets invented.
 */
interface PostAuthor {
  id?: string;
  name?: string;
  avatarUrl?: string | null;
}

/**
 * The feed shape this page reads and passes straight into `<PostCard
 * post={...} />` — structurally compatible with PostCard's own (non-exported)
 * local `Post` interface, which is not exported from PostCard.tsx.
 */
interface Post {
  id: string;
  author: PostAuthor;
  content: string;
  createdAt?: Date | string | number | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

/**
 * Deals `items` across `count` columns round robin — 0 to the first, 1 to the
 * second, 2 to the third, 3 back to the first. Used for the loading
 * placeholders, which exist for exactly one render and have no identity of
 * their own to preserve.
 */
const intoColumns = (items: number[], count: number): number[][] => {
  const columns: number[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => columns[index % count].push(item));
  return columns;
};

/**
 * Deals `posts` across `count` columns by a hash of each post's id, not its
 * position in the array.
 *
 * Posts are long-lived, unlike the placeholders above: `handlePostCreated`
 * prepends, which shifts every existing post's array index by one. Dealt by
 * position, that reassigns nearly every post to a different column's <ul> on
 * the very next post anyone creates, and React unmounts the PostCard that
 * used to live there — even though `key={post.id}` never changed — silently
 * closing an open comment panel and dropping whatever the reader was
 * mid-typing into it. A hash of the id, the same trick `tiltFor` in PostCard
 * uses for the same reason, is stable under prepend, append, and delete
 * alike. What it gives up: the "three newest notices land in the top row"
 * property round robin gave the feed's first paint — a post's column is now
 * fixed by its id, not by when it arrived.
 */
const columnFor = (id: string | undefined, count: number): number => {
  const hash = [...String(id ?? "")].reduce(
    (h, ch) => (h * 31 + ch.charCodeAt(0)) % 997,
    7
  );
  return hash % count;
};

const intoPostColumns = (posts: Post[], count: number): Post[][] => {
  const columns: Post[][] = Array.from({ length: count }, () => []);
  posts.forEach((post) => columns[columnFor(post.id, count)].push(post));
  return columns;
};

/*
 * THE TRADE-OFF, STATED: three columns means three lists, and a screen reader
 * walks them one after another. So the wall is announced column-major — a
 * scattered, id-determined subset of notices, then another, then a third —
 * and not newest first, which is the order the feed actually arrives in and
 * the order the eye reads across the top row. This is the standing cost of
 * every masonry layout: there is no markup that is simultaneously three
 * independent vertical stacks visually and one flat sequence to assistive
 * technology.
 *
 * Taken deliberately, with two mitigations rather than a pretence that it is
 * not there. Each list says which column it is, so its position on the wall is
 * audible instead of being guessed at; and every notice carries its own <time>
 * with a machine-readable datetime, so the chronology is recoverable from any
 * single notice without reference to where it sits. Below 720 there is one
 * list, in true feed order, and the problem disappears entirely.
 */
const columnLabel = (index: number, count: number): string =>
  count === 1 ? "Notices" : `Notices, column ${index + 1} of ${count}`;

/**
 * How many columns fit. Two subscriptions rather than one, because a media
 * query answers yes or no and there are three answers.
 */
const useColumnCount = (): number => {
  const belowThree = useNarrowerThan(THREE_COLUMNS);
  const belowTwo = useNarrowerThan(TWO_COLUMNS);

  if (belowTwo) return 1;
  return belowThree ? 2 : 3;
};

const PostsPage = () => {
  const [actionError, setActionError] = useState("");
  const { currentUser } = useAuth();
  const columnCount = useColumnCount();
  const queryClient = useQueryClient();

  const feedQuery = useInfiniteQuery({
    queryKey: queryKeys.posts.feed(),
    queryFn: ({ pageParam }) => postsApi.listPosts({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  // Memoized on the query's own data, not left as a bare derived expression:
  // `flatMap(...) ?? []` would otherwise hand back a new array identity every
  // render, which defeats `peopleInTheSquare`'s memoization below (it depends
  // on `posts`) for no reason — the underlying pages haven't changed.
  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [feedQuery.data]
  );

  // One visible error slot answers for the feed, a like, and a delete (see the
  // role="alert" paragraph below) — the composer reports its own failures on
  // its own field. `actionError` covers the like/delete mutations; the load
  // failure is read straight off the query each render rather than mirrored
  // into state, so there is nothing here to keep in sync with an effect.
  const loadErrorMessage =
    feedQuery.error instanceof Error
      ? feedQuery.error.message
      : feedQuery.error
        ? String(feedQuery.error)
        : "";
  const error = actionError || loadErrorMessage;

  // Patches one post inside the infinite-query cache — the query-cache
  // equivalent of the old local-state `patchPost` helper, same call sites and
  // the same `Partial<Post>` merge semantics.
  const patchFeedPost = (postId: string, changes: Partial<Post>) => {
    queryClient.setQueryData<InfiniteData<{ posts: Post[]; nextCursor: string | null }>>(
      queryKeys.posts.feed(),
      (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) =>
              post.id === postId ? { ...post, ...changes } : post
            ),
          })),
        }
    );
  };

  /**
   * Who is "in the square right now": the distinct authors of the notices
   * currently on the wall, in feed order, so the most recent writer is the
   * first face.
   *
   * There is no presence endpoint on this server — apps/server/src/routes/
   * holds postRoutes and userRoutes and nothing else — and adding one is not
   * this screen's job. This is not a placeholder pretending to be presence, it
   * is an honest reading of the phrase: these are the people whose notices are
   * up. It also costs nothing. Deriving it from state we already hold is the
   * point; a strip that called listUsers, or a per-face profile fetch, would
   * put the feed straight back into the per-request-per-item habit that the
   * embedded-author feed shape exists to keep it out of.
   *
   * A real signal — a heartbeat endpoint, or last-seen on the user row — is
   * what replaces this, and PresenceStrip takes its people as a prop precisely
   * so that swap is this memo and nothing else.
   */
  const peopleInTheSquare = useMemo(() => {
    const seen = new Set<string | undefined>();
    const people: PostAuthor[] = [];

    posts.forEach(({ author }) => {
      if (author && !seen.has(author.id)) {
        seen.add(author.id);
        people.push(author);
      }
    });

    return people;
  }, [posts]);

  const handleCommentAdded = (postId: string) => {
    const post = posts.find((candidate) => candidate.id === postId);
    if (post) {
      patchFeedPost(postId, { commentCount: post.commentCount + 1 });
    }
  };

  /**
   * Applies the like optimistically and rolls back if the request fails.
   *
   * The server owns the count, so its response is what finally lands — two
   * people liking at once no longer produces two different totals on screen.
   */
  const likeMutation = useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      isLiked ? postsApi.unlikePost(postId) : postsApi.likePost(postId),
    onMutate: ({ postId, isLiked }) => {
      const post = posts.find((candidate) => candidate.id === postId);
      if (post) {
        patchFeedPost(postId, {
          likedByMe: !isLiked,
          likeCount: post.likeCount + (isLiked ? -1 : 1),
        });
      }
      return { previous: post };
    },
    onSuccess: (likeCount, { postId }) => patchFeedPost(postId, { likeCount }),
    onError: (err, { postId }, context) => {
      if (context?.previous) {
        patchFeedPost(postId, {
          likedByMe: context.previous.likedByMe,
          likeCount: context.previous.likeCount,
        });
      }
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message` rather than reaching for a cast.
      setActionError(err instanceof Error ? err.message : String(err));
    },
  });
  const handleLike = (postId: string, isLiked: boolean) =>
    likeMutation.mutate({ postId, isLiked });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => postsApi.deletePost(postId),
    onMutate: (postId) => {
      const snapshot = queryClient.getQueryData(queryKeys.posts.feed());
      queryClient.setQueryData<
        InfiniteData<{ posts: Post[]; nextCursor: string | null }>
      >(
        queryKeys.posts.feed(),
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((post) => post.id !== postId),
            })),
          }
      );
      return { snapshot };
    },
    onError: (err, postId, context) => {
      // A post someone else already deleted should stay gone on screen.
      if (!(err instanceof ApiRequestError) || err.status !== 404) {
        queryClient.setQueryData(queryKeys.posts.feed(), context?.snapshot);
      }
      setActionError(err instanceof Error ? err.message : String(err));
    },
  });
  const handleDelete = (postId: string) => deleteMutation.mutate(postId);

  const columns = intoPostColumns(posts, columnCount);
  const placeholders = intoColumns(
    Array.from({ length: columnCount * SKELETONS_PER_COLUMN }, (_, index) => index),
    columnCount
  );

  // No max-width and no background: Plaza owns the 1100px column and the paved
  // ground, and a screen that painted either would be striking the paving a
  // second time from its own box. See the header of Components/Plaza.js.
  return (
    <div>
      {/* role="alert" rather than the old .alert div, because this appears
          after a request fails instead of being on screen all along. It answers
          for the feed, a like, and a delete — the composer reports its own
          failures on its own field, where the text still is. */}
      {error && (
        <p role="alert" style={ERROR}>
          {error}
        </p>
      )}

      {/* The composer carries its own top margin, which is why nothing here
          positions it. It reads the signed-in user from context and prepends
          its own created post straight into the feed's query cache. */}
      <AddPostForm />

      <PresenceStrip people={peopleInTheSquare} style={STRIP} />

      {/* aria-busy on the region, because Skeleton is aria-hidden by design and
          the region is therefore the only thing left that can say it is
          loading. A screen reader announcing six grey rectangles is worse than
          silence. */}
      <div style={REGION} aria-busy={feedQuery.isLoading}>
        {feedQuery.isLoading ? (
          <div style={wallStyle(columnCount)}>
            {placeholders.map((items, index) => (
              <ul key={index} style={COLUMN} aria-label={columnLabel(index, columnCount)}>
                {items.map((placeholder) => (
                  <SkeletonNotice key={placeholder} />
                ))}
              </ul>
            ))}
          </div>
        ) : posts.length === 0 ? (
          /* EmptyState, and this is the case its header describes: it replaces
             a whole region and therefore sits on the ground, in ink and muted.
             No `action` — the composer is 24px above it and the only thing an
             action here could do is scroll the reader to a control they are
             already looking at. */
          <EmptyState
            title="The wall is bare"
            description="Nobody has pinned anything up yet. Say something in the composer above and yours is the first notice on the square."
          />
        ) : (
          <div style={wallStyle(columnCount)}>
            {columns.map((items, index) => (
              <ul key={index} style={COLUMN} aria-label={columnLabel(index, columnCount)}>
                {items.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onLike={handleLike}
                    onCommentAdded={handleCommentAdded}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            ))}
          </div>
        )}
      </div>

      {/* `secondary` is safe on the ground — its --color-muted border measures
          4.62:1 by day and 5.69:1 at night — and is not safe on a notice, where
          the same border is 2.62:1 in Slate Night. This one stands on the
          ground. See the header of Components/ui/Button.js. */}
      {feedQuery.hasNextPage && (
        <div style={LOAD_MORE}>
          <Button
            variant="secondary"
            onClick={() => feedQuery.fetchNextPage()}
            disabled={feedQuery.isFetchingNextPage}
          >
            {feedQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PostsPage;
