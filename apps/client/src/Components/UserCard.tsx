import React, { useState } from "react";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import Notice from "./ui/Notice";

/*
 * Icons are inline SVG on a 24 grid, stroke-based — the same Glyph pattern
 * PostCard.js and Navbar.js use — never emoji, never the react-icons/fa
 * glyphs this file used to import.
 */
const Glyph = ({ children }: { children?: React.ReactNode }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const UserPlusIcon = () => (
  <Glyph>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M18.5 6.5v6" />
    <path d="M15.5 9.5h6" />
  </Glyph>
);

const UserXIcon = () => (
  <Glyph>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 7.5l5 5" />
    <path d="M21.5 7.5l-5 5" />
  </Glyph>
);

const CARD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  textAlign: "center",
};

// The same ring PostCard draws around its (much smaller) inline avatar, in the
// notice's own die-cut colour, so this face reads as punched out of the paper
// the same way that one does.
const AVATAR_RING: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: "50%",
  boxShadow: "0 0 0 3px var(--color-keyline)",
};

const NAME: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 18,
  lineHeight: 1.25,
  // inherit, not paper-ink stated again: Notice's SURFACE already set it, and
  // a person's own name reads better set naturally than shouted the way
  // PostCard uppercases an author byline above someone else's words.
  color: "inherit",
};

const ERROR: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-like)",
};

/**
 * The user shape this card draws — the same fields Avatar's own `AvatarUser`
 * accepts, except `id` is required here: unlike Avatar (which has to render a
 * partial or missing user), every call site in this codebase
 * (AllUsers.js, SearchResults.js) always passes a real row with a real id,
 * and `changeFriendship` below sends `user.id` on to `onFriendChange`, which
 * expects a real one. Not imported from Avatar.tsx because it is not exported
 * there.
 */
interface UserCardUser {
  id: string;
  name?: string;
  avatarUrl?: string | null;
}

interface UserCardProps {
  /** { id, name, avatarUrl }, required */
  user: UserCardUser;
  /** whether the viewer already knows this person */
  isFriend?: boolean;
  /** (userId, "add" | "remove") => Promise<void>. Optional: its absence is
   * what hides the friend-action button, which is how SearchResults renders
   * this same card read-only */
  onFriendChange?: (userId: string, action: "add" | "remove") => Promise<void>;
}

/**
 * A notice about a person: their face, their name, and — when the caller
 * hands down a handler — the one thing you can do about knowing them.
 *
 * `author={user}` is what tints the paper: Notice takes its hue from
 * avatarColor, the same hue Avatar draws the face in, so a person's card and
 * a person's face can never drift apart.
 *
 * Props:
 *   user           — { id, name, avatarUrl }, required
 *   isFriend       — whether the viewer already knows this person
 *   onFriendChange — (userId, "add" | "remove") => Promise<void>. Optional:
 *                    its absence is what hides the friend-action button, which
 *                    is how SearchResults renders this same card read-only
 */
const UserCard = ({ user, isFriend, onFriendChange }: UserCardProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const changeFriendship = async (action: "add" | "remove") => {
    setIsLoading(true);
    setError("");
    try {
      // `onFriendChange` is optional in the props type, and this function is
      // only ever wired up when `onFriendChange &&` is truthy in the JSX
      // below — but that conditional-rendering fact is invisible to
      // TypeScript's control-flow analysis inside this closure, so the
      // optional call is required rather than a direct invocation.
      await onFriendChange?.(user.id, action);
    } catch (err) {
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message` rather than reaching for a cast.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Notice as="li" author={user} padding="26px 20px">
      <div style={CARD}>
        <span style={AVATAR_RING}>
          <Avatar user={user} size={84} />
        </span>

        <h3 style={NAME}>{user.name}</h3>

        {/* Email and address are deliberately absent: the API returns them
            only to the account owner, so there is nothing to render here. */}

        {onFriendChange &&
          (isFriend ? (
            <Button
              variant="danger"
              size={34}
              onClick={() => changeFriendship("remove")}
              disabled={isLoading}
              title="Remove friend"
            >
              <UserXIcon />
              {isLoading ? "Removing…" : "Unfriend"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size={34}
              onClick={() => changeFriendship("add")}
              disabled={isLoading}
            >
              <UserPlusIcon />
              {isLoading ? "Adding…" : "Add friend"}
            </Button>
          ))}

        {/* role="alert": this appears after a failed add/remove rather than
            being present all along, so it has to interrupt to be heard. */}
        {error && (
          <p role="alert" style={ERROR}>
            {error}
          </p>
        )}
      </div>
    </Notice>
  );
};

export default UserCard;
