import React, { useId, useState } from "react";
import * as postsApi from "../api/posts";
import { machineTime, timeAgo } from "../lib/timeAgo";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import Field from "./ui/Field";
import Notice from "./ui/Notice";
import Skeleton from "./ui/Skeleton";

/*
 * Icons are inline SVG on a 24 grid, stroke-based — the rule EmptyState states
 * at greater length. `stroke="currentColor"` is what lets one drawing work on
 * paper and on the paved ground, and it is exactly what the react-icons glyphs
 * that used to be here could not do: they arrived with a colour of their own and
 * pulled a whole icon package into the bundle for three shapes.
 */
const Glyph = ({ filled = false, children }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const HeartIcon = ({ filled }) => (
  <Glyph filled={filled}>
    <path d="M12 20.4c-1.2-.8-7.4-4.9-7.4-9.9a4.3 4.3 0 0 1 7.4-2.9 4.3 4.3 0 0 1 7.4 2.9c0 5-6.2 9.1-7.4 9.9z" />
  </Glyph>
);

const BubbleIcon = () => (
  <Glyph>
    <path d="M20.2 12.2a7.6 7.6 0 0 1-11 6.8l-4.6 1.4 1.4-4.5a7.6 7.6 0 1 1 14.2-3.7z" />
  </Glyph>
);

const TrashIcon = () => (
  <Glyph>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7" />
    <path d="M6.8 7l.8 12a1.9 1.9 0 0 0 1.9 1.8h5a1.9 1.9 0 0 0 1.9-1.8l.8-12" />
    <path d="M10.4 11v6M13.6 11v6" />
  </Glyph>
);

/*
 * The six angles the artboard leans its notices at, and nothing else. A wall of
 * pinned paper only reads as pinned paper while every sheet is off-square by an
 * amount somebody chose.
 */
const TILTS = [-1.6, 1.4, 1.1, -1.2, -0.8, 0.7];

/**
 * Which of them a post gets: the multiply-and-add string hash `avatarHue` uses,
 * over the post id.
 *
 * Neither Math.random() nor the array index. A random angle is re-rolled on
 * every render and this list re-renders on every like, so the whole wall would
 * twitch each time somebody tapped a heart. An index is stable within a render
 * but belongs to the position rather than to the post, so deleting one notice
 * re-shuffles every sheet after it. The id is the one thing about a post that
 * never moves.
 */
const tiltFor = (id) => {
  const hash = [...String(id ?? "")].reduce(
    (h, ch) => (h * 31 + ch.charCodeAt(0)) % 360,
    7
  );
  return TILTS[hash % TILTS.length];
};

const AVATAR_SLOT = {
  display: "inline-flex",
  // The disc carries an explicit width, but a flex item still shrinks by
  // default — without this the face goes oval next to a long name.
  flexShrink: 0,
  borderRadius: "50%",
  // The ring the artboard draws around every face, in the notice's own die-cut
  // colour, so the disc reads as punched out of the sheet it sits on.
  boxShadow: "0 0 0 3px var(--color-keyline)",
};

const AUTHOR_ROW = { display: "flex", alignItems: "center", gap: 12 };

const AUTHOR_NAME = {
  fontFamily: "var(--font-display)",
  fontSize: 13,
  letterSpacing: "-0.005em",
  // Transformed rather than trusted: names come from Firebase and from a
  // free-text profile field, in whatever case their owner typed them.
  textTransform: "uppercase",
};

const TIMESTAMP = { fontSize: 11.5, color: "var(--color-paper-muted)" };

const CONTENT = {
  margin: "13px 0 0",
  fontSize: 15.5,
  lineHeight: 1.55,
  textWrap: "pretty",
  // A post is plain text and never an image, so a pasted URL or a single
  // unbroken word is the only thing here that can be wider than the paper.
  overflowWrap: "anywhere",
};

// Button's own paddingInline at size 34.
const ACTION_PADDING = 14;

const ACTIONS = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  marginTop: 15,
  // Pulled back by the button's padding so the first label stands on the same
  // vertical as the content above it instead of 14px inside it.
  marginLeft: -ACTION_PADDING,
};

const ACTION_LABEL = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  // The like count changes under the reader's finger; tabular figures stop it
  // shoving the replies button sideways when it does.
  fontVariantNumeric: "tabular-nums",
};

const MUTED_ACTION = { color: "var(--color-paper-muted)" };

/*
 * The heart is warm red when it is filled and muted when it is not — never the
 * accent. theme.css says this at the token: mint on a like reads as a status
 * tick, not as affection.
 */
const likeStyle = (liked) => (liked ? { color: "var(--color-like)" } : MUTED_ACTION);

const DELETE_BUTTON = {
  ...MUTED_ACTION,
  marginLeft: "auto",
  // An icon button is square. Button's 14px inline padding is measured for a
  // text label, and around an 18px glyph it makes a 46x34 lozenge.
  paddingInline: 0,
  width: 34,
};

const PANEL = {
  marginTop: 14,
  paddingTop: 14,
  // A knock-back of the surface's own ink, not the keyline: the keyline is
  // near-white and a rule drawn in it on paper is a rule nobody can see. Same
  // argument Skeleton makes for borrowing currentColor.
  borderTop: "1px solid color-mix(in oklab, currentColor 14%, transparent)",
};

const SKELETON_STACK = { display: "flex", flexDirection: "column", gap: 10 };

const COMMENT_LIST = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const COMMENT_META = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-paper-muted)",
};

const COMMENT_TEXT = {
  margin: "2px 0 0",
  fontSize: 14,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const EMPTY_LINE = { margin: 0, fontSize: 13, color: "var(--color-paper-muted)" };

// Field's own error type, restated here: this message answers for two
// operations, only one of which is the field's.
const ERROR = {
  margin: "12px 0 0",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-like)",
};

const FORM = { marginTop: 14 };

const FORM_ACTIONS = { display: "flex", justifyContent: "flex-end", marginTop: 10 };

const MAX_COMMENT_LENGTH = 1000;

/**
 * One notice on the plaza wall: a sheet of paper, tinted in its author's own
 * hue, leaning a degree or two off square.
 *
 * `author={post.author}` is what tints it — Notice takes the hue from
 * avatarColor, so a person's notice and a person's face are drawn in one colour
 * and can never drift apart.
 *
 * Props:
 *   post            — the feed shape: author, content, createdAt, likeCount,
 *                     commentCount, likedByMe
 *   currentUser     — the signed-in Firebase user; only `.uid` is read
 *   onLike          — (postId, likedByMe) => void
 *   onCommentAdded  — (postId) => void, so the caller can move its own count
 *   onDelete        — (postId) => void. Optional: its absence is what hides the
 *                     delete affordance on search results
 */
const PostCard = ({ post, currentUser, onLike, onCommentAdded, onDelete }) => {
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Generated, not a literal: one post can appear twice on a page — the feed
  // and a search result — and two panels sharing an id would leave both
  // buttons pointing at the first one.
  const panelId = `${useId()}-replies`;

  // Search results render posts without a delete handler, so the button is
  // hidden there rather than shown and inert.
  const canDelete = Boolean(onDelete) && currentUser?.uid === post.author.id;

  /**
   * Comments load when the reader asks for them, not on mount.
   *
   * Every card used to fetch the full comment list and the author's profile as
   * soon as it rendered, so opening the feed fired two requests per post before
   * anyone had clicked anything.
   */
  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setShowComments(true);
    if (commentsLoaded) return;

    setIsLoadingComments(true);
    try {
      const { comments: loaded } = await postsApi.listComments(post.id);
      setComments(loaded);
      setCommentsLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      // Render what the server actually stored. The old code pushed the raw
      // input string into a list of comment objects, which is why the markup
      // had a JSON.stringify fallback for comments with no .content.
      const created = await postsApi.addComment(post.id, newComment);
      setComments((current) => [...current, created]);
      setCommentsLoaded(true);
      setShowComments(true);
      setNewComment("");
      onCommentAdded?.(post.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      onDelete(post.id);
    }
  };

  return (
    <Notice
      as="li"
      author={post.author}
      padding="20px 22px 22px"
      // No willChange: the rotation is set once per post and never animates, so
      // a compositing hint would buy a whole layer for nothing.
      style={{
        transform: `rotate(${tiltFor(post.id)}deg)`,
        transformOrigin: "center",
      }}
    >
      <div style={AUTHOR_ROW}>
        <span style={AVATAR_SLOT}>
          <Avatar user={post.author} size={40} />
        </span>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={AUTHOR_NAME}>{post.author.name}</span>
          {/* createdAt has always arrived on every post and no screen has ever
              shown it, so the wall read as one undated pile. The machine-
              readable copy is what makes it a date to anything that is not a
              pair of eyes. */}
          <time dateTime={machineTime(post.createdAt)} style={TIMESTAMP}>
            {timeAgo(post.createdAt)}
          </time>
        </div>

        {canDelete && (
          <Button
            variant="ghost"
            size={34}
            onClick={handleDelete}
            aria-label="Delete post"
            style={DELETE_BUTTON}
          >
            <TrashIcon />
          </Button>
        )}
      </div>

      <p style={CONTENT}>{post.content}</p>

      <div style={ACTIONS}>
        <Button
          variant="ghost"
          size={34}
          onClick={() => onLike(post.id, post.likedByMe)}
          // The visible label is a bare number, which on its own tells a screen
          // reader nothing about what it counts. aria-pressed carries the state,
          // so the label does not have to flip between "Like" and "Unlike".
          aria-pressed={post.likedByMe}
          aria-label={`${post.likeCount} ${post.likeCount === 1 ? "like" : "likes"}`}
          style={likeStyle(post.likedByMe)}
        >
          <span style={ACTION_LABEL}>
            <HeartIcon filled={post.likedByMe} />
            {post.likeCount}
          </span>
        </Button>

        <Button
          variant="ghost"
          size={34}
          onClick={toggleComments}
          aria-expanded={showComments}
          aria-controls={panelId}
          style={MUTED_ACTION}
        >
          <span style={ACTION_LABEL}>
            <BubbleIcon />
            {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
          </span>
        </Button>
      </div>

      {showComments && (
        // aria-busy, not a live region: Skeleton is aria-hidden by design, so
        // the region itself is the only thing left that can say it is loading.
        <div id={panelId} style={PANEL} aria-busy={isLoadingComments}>
          {isLoadingComments ? (
            // Bars rather than nothing. An empty panel that fills in half a
            // second later reads as "no replies" for exactly as long as the
            // request takes, and then contradicts itself.
            <div style={SKELETON_STACK}>
              <Skeleton width="45%" />
              <Skeleton />
              <Skeleton width="70%" />
            </div>
          ) : (
            <>
              {/* A line, not an EmptyState. That primitive says in its own
                  header that it replaces a whole region and therefore sits on
                  the ground — ink, muted, a chip-filled icon slot, 40px of
                  padding. Dropped inside a notice it would be a second notice
                  with nothing in it, and its title would outweigh the post it
                  hangs under. */}
              {commentsLoaded && comments.length === 0 && (
                <p style={EMPTY_LINE}>No replies yet.</p>
              )}

              {comments.length > 0 && (
                <ul style={COMMENT_LIST}>
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <p style={COMMENT_META}>
                        {comment.author.name}
                        {" · "}
                        <time dateTime={machineTime(comment.createdAt)}>
                          {timeAgo(comment.createdAt)}
                        </time>
                      </p>
                      <p style={COMMENT_TEXT}>{comment.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* role="alert" because this appears after a failed request rather
              than being present all along. It is not handed to Field: the same
              state also carries the failure of the list request, which is not a
              problem with anything the reader typed. */}
          {error && (
            <p role="alert" style={ERROR}>
              {error}
            </p>
          )}

          <form onSubmit={handleCommentSubmit} style={FORM}>
            {/* A real label, not a placeholder standing in for one — a
                placeholder is a hint that disappears the moment somebody types,
                and no assistive technology treats it as a name. */}
            <Field
              label="Write a reply"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
            />

            <div style={FORM_ACTIONS}>
              <Button
                type="submit"
                size={34}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting…" : "Reply"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Notice>
  );
};

export default PostCard;
