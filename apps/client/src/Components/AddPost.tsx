import React, { useEffect, useRef, useState } from "react";
import * as postsApi from "../api/posts";
import { useAuth } from "../contexts/AuthContext";
import { usePlazaProfile } from "../contexts/PlazaProfile";
import { useNarrowerThan } from "../lib/useMediaQuery";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import Field from "./ui/Field";
import Notice from "./ui/Notice";
// The same two numbers the plaza header uses. A screen that invented its own
// breakpoint would reflow half a beat before or after the header above it.
import { COMPACT, NARROW } from "./Plaza";

const MAX_LENGTH = 5000;

/**
 * The partial user shape this screen draws — the same fields Avatar's own
 * `AvatarUser` accepts. Not imported from Avatar.tsx because it is not
 * exported there; kept local and permissive for the same reason as Avatar's
 * own comment: `api/users.ts` still returns an untyped row, so this is not
 * the place a shared, stricter `User` type gets invented.
 */
interface AddPostUser {
  id?: string;
  name?: string;
  avatarUrl?: string | null;
}

interface AddPostFormProps {
  /** Called with the created post. `postsApi.createPost` has no declared
   * return type, so there is nothing more specific to read off it here than
   * "pass it through". */
  onPostCreated: (post: unknown) => void;
  /** The signed-in person, `{ id, name, avatarUrl }`. Optional; see the
   * comment on `me` for why this is never fetched here. */
  user?: AddPostUser;
}

// The pill's width on a roomy screen. Below COMPACT it gives way and the
// composer spans the column, which is what the mobile artboard draws.
const PILL_WIDTH = 620;

const KEYLINE: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  // The same 6px die-cut rim Notice uses, so the closed composer and the
  // notices below it read as cut from one sheet.
  padding: 6,
  border: "none",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-keyline)",
  boxShadow: "var(--shadow-notice)",
  fontFamily: "var(--font-body)",
  textAlign: "left",
  cursor: "pointer",
};

const PAPER_ROW: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 14,
  // Asymmetric: the avatar wants room on the left, the POST chip brings its own
  // on the right.
  padding: "14px 16px 14px 22px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-paper)",
};

const PROMPT: React.CSSProperties = {
  flexGrow: 1,
  minWidth: 0,
  fontSize: 16,
  fontStyle: "italic",
  color: "var(--color-paper-muted)",
  // The prompt is the only thing here that can be squeezed, so it is the only
  // thing allowed to trail off rather than wrap the pill onto two lines.
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/*
 * The artboard sets this chip — and the expanded composer's POST button — in
 * Archivo Black. Both are drawn in the body face at weight 600 instead, because
 * that is what the shipped Button does and its header states that variants
 * differ only in fill, border and label colour. The primitive is the reviewed
 * implementation of the design system; one screen forking its typography would
 * leave the real POST button and the chip that stands in for it disagreeing by
 * a whole typeface. A chosen deviation from the artboard, recorded, not a slip.
 */
const POST_CHIP: React.CSSProperties = {
  flexShrink: 0,
  padding: "11px 22px",
  borderRadius: "var(--radius-pill)",
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: "0.04em",
  background: "var(--color-accent)",
  color: "var(--color-on-accent)",
};

// The disc carries an explicit width, but a flex item still shrinks by default
// — without this the avatar goes oval on a narrow phone.
const AVATAR_SLOT: React.CSSProperties = { display: "inline-flex", flexShrink: 0 };

const AUTHOR_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const AUTHOR_NAME: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const ACTIONS: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 12,
};

const COUNT: React.CSSProperties = {
  flexGrow: 1,
  fontSize: 13,
  color: "var(--color-paper-muted)",
  // Tabular figures, so the count does not shove the buttons sideways on every
  // keystroke.
  fontVariantNumeric: "tabular-nums",
};

// Button's ring, to the pixel. The pill is where focus lands when the composer
// closes, so it has to be able to show that it has it.
const FOCUS_RING: React.CSSProperties = {
  outline: "2px solid var(--color-accent)",
  outlineOffset: 2,
};

/**
 * The composer: the pill standing at the centre of the plaza, and the notice it
 * opens into.
 *
 * Props:
 *   onPostCreated — called with the created post
 *   user          — the signed-in person, `{ id, name, avatarUrl }`. Optional;
 *                   see the comment on `me` for why this is never fetched here
 */
const AddPostForm = ({ onPostCreated, user }: AddPostFormProps) => {
  const { currentUser } = useAuth();
  const profile = usePlazaProfile();
  const compact = useNarrowerThan(COMPACT);
  const narrow = useNarrowerThan(NARROW);

  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [ringVisible, setRingVisible] = useState<boolean>(false);

  const pillRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Separates "closed because nobody has opened it yet" from "closed again", so
  // the first render does not yank focus out of wherever the reader left it.
  const hasOpened = useRef(false);

  /*
   * No request from here, on purpose. Plaza already loads this exact user for
   * the header avatar, and fetching again would make one screen ask the server
   * twice for one row — the per-item-fetch habit the feed shape exists to
   * prevent. Plaza publishes what it loaded, so the composer draws the same
   * face as the header instead of a blank disc: `{ id: uid }` alone gets the
   * hue right but yields no initials, because a Firebase uid is not a name.
   * An explicit `user` prop still wins, for a caller that holds the row
   * already.
   */
  const me: AddPostUser = user ?? profile ?? { id: currentUser?.uid };

  /*
   * Opening focuses the textarea; closing hands focus back to the pill that
   * opened it. This is why Field forwards its ref to the control and why Button
   * is a forwardRef — a control that opens something and never takes focus back
   * strands a keyboard user at the top of the document.
   */
  useEffect(() => {
    if (isOpen) {
      hasOpened.current = true;
      textRef.current?.focus();
    } else if (hasOpened.current) {
      pillRef.current?.focus();
    }
  }, [isOpen]);

  const close = () => {
    setText("");
    setError("");
    setIsOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!text.trim()) {
      setError("Post content cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      // The author is taken from the verified token server-side, so nothing
      // about identity is sent from here.
      const post = await postsApi.createPost(text);
      onPostCreated(post);
      close();
    } catch (err) {
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message` rather than reaching for a cast.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Escape closes an empty composer and nothing else. A draft somebody has
  // typed is not something a key pressed by reflex gets to throw away — Cancel
  // does that, and Cancel is labelled.
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (event.key === "Escape" && !text) close();
  };

  const frame: React.CSSProperties = {
    maxWidth: compact ? "100%" : PILL_WIDTH,
    margin: `${compact ? 22 : 34}px auto 0`,
  };

  if (!isOpen) {
    return (
      <button
        ref={pillRef}
        type="button"
        onClick={() => setIsOpen(true)}
        /*
         * The WHOLE pill is one button, and the POST chip inside it is a <span>.
         * A <button> nested inside a <button> is invalid HTML and browsers
         * resolve it however they please — some drop the inner one, some nest it
         * and fire both handlers. It is also the honest model: while the
         * composer is closed there is no text, so there is nothing a second
         * control could do that this one does not already do. Hence an explicit
         * accessible name — the chip is decoration and the avatar is the
         * reader's own face, so neither should be read out as the label.
         */
        aria-label="Say something to the square"
        onFocus={(event: React.FocusEvent<HTMLButtonElement>) =>
          // :focus-visible is what separates keyboard focus from the focus a
          // mouse click leaves behind, and an inline style cannot hold a
          // pseudo-class. Same trick, same reason, as Button.
          setRingVisible(event.target.matches(":focus-visible"))
        }
        onBlur={() => setRingVisible(false)}
        style={{ ...KEYLINE, ...frame, ...(ringVisible ? FOCUS_RING : null) }}
      >
        <span style={PAPER_ROW}>
          <span style={AVATAR_SLOT}>
            <Avatar user={me} size={40} />
          </span>

          <span style={PROMPT}>
            {narrow ? "Say something…" : "Say something to the square…"}
          </span>

          <span style={POST_CHIP} aria-hidden="true">
            POST
          </span>
        </span>
      </button>
    );
  }

  return (
    /*
     * `author={me}` is the whole point: the paper takes the writer's own hue,
     * the one their avatar is drawn in, so what they are typing already looks
     * like the notice it is about to become. `as="form"` because Notice spreads
     * the rest of its props onto its wrapper — the keyline rim then hugs the
     * form itself instead of sitting inside a redundant extra element.
     */
    <Notice as="form" author={me} onSubmit={handleSubmit} style={frame}>
      <div style={AUTHOR_ROW}>
        <span style={AVATAR_SLOT}>
          <Avatar user={me} size={40} />
        </span>
        <span style={AUTHOR_NAME}>{me.name ?? "You"}</span>
      </div>

      {/*
       * A real label, not a placeholder standing in for one. Every form in this
       * app pairs htmlFor and id as matching literal strings today, and a
       * placeholder is not a label to any assistive technology — it is a hint
       * that disappears the moment somebody starts typing. Field generates the
       * pair. The API's failure message rides in `error` so it is announced and
       * tied to the control, rather than floating above the composer as the
       * old .alert div did.
       */}
      <Field
        ref={textRef}
        as="textarea"
        label="Say something to the square"
        value={text}
        onChange={(
          event: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >
        ) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_LENGTH}
        error={error}
        required
        rows={4}
      />

      {/*
       * The buttons go disabled while a post is in flight; the textarea does
       * not. Disabling a focused control blurs it, so a request that then fails
       * would drop the reader on <body> with an error message they are no
       * longer standing next to — the one place focus must not move is the
       * field holding the text they are about to be told is a problem.
       */}
      <div style={ACTIONS}>
        <span style={COUNT}>
          {text.length} / {MAX_LENGTH}
        </span>

        <Button type="submit" variant="primary" disabled={isSubmitting || !text.trim()}>
          {isSubmitting ? "Posting…" : "Post"}
        </Button>

        <Button variant="ghost" onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </Notice>
  );
};

export default AddPostForm;
