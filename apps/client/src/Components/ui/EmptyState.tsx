import React from "react";

/*
 * Icons are drawn here as inline SVG on a 24px grid, stroke-based, never emoji
 * and never FontAwesome — that package stayed installed only for as long as
 * some screen still had an <i className="fas ..."> in it, and it is gone now
 * that the last one (Dashboard/UpdateProfile) has been rebuilt.
 *
 * `stroke="currentColor"` is what makes one drawing work on paper and on the
 * paved ground: the icon takes the colour of the slot it is dropped into.
 */
const BlankNoticeIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3.5" y="5.5" width="17" height="14" rx="3" />
    <path d="M8 11h8" />
    <path d="M8 15h5" />
  </svg>
);

const ROOT = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: 10,
  padding: "40px 24px",
  textAlign: "center" as const,
  fontFamily: "var(--font-body)",
};

const ICON_SLOT = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 52,
  height: 52,
  marginBottom: 2,
  borderRadius: "50%",
  background: "var(--color-chip)",
  color: "var(--color-muted)",
};

/*
 * ink/muted rather than paper-ink/paper-muted, and that is a statement about
 * where this goes: an empty state replaces a whole region of the plaza — the
 * feed, the search results — so it sits on the ground, not on a sheet of paper.
 * An empty state inside a notice would be a notice with nothing in it.
 */
const TITLE = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 20,
  lineHeight: 1.2,
  color: "var(--color-ink)",
};

const COPY = {
  margin: 0,
  // A measure, not a width: centred prose past about 45 characters a line stops
  // being scannable and the eye loses the start of the next line.
  maxWidth: "42ch",
  fontSize: 15,
  lineHeight: 1.5,
  color: "var(--color-muted)",
};

/**
 * What a region says when it holds nothing.
 *
 * The app has none of these today, so an empty feed is a blank column and an
 * empty search is a bare "No results" — both of which read as the app being
 * broken rather than as an answer.
 *
 * Props:
 *   icon        — a node for the icon slot; a blank-notice glyph when omitted.
 *                 Pass `false` for no icon at all
 *   title       — the headline
 *   description — one line of copy explaining what would go here
 *   action      — a node, normally a <Button>; omitted when there is nothing
 *                 useful to offer
 *   className / style — passed through
 *   ...rest     — anything else lands on the wrapper
 */
export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  icon?: React.ReactNode | false;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

const EmptyState = ({
  icon,
  title,
  description,
  action,
  className = "",
  style,
  ...rest
}: EmptyStateProps) => (
  <div {...rest} className={className} style={{ ...ROOT, ...style }}>
    {icon !== false ? (
      // aria-hidden on the slot, not on the glyph: whatever a caller passes in
      // is decoration here, and the headline below is the accessible name.
      <span style={ICON_SLOT} aria-hidden="true">
        {icon ?? <BlankNoticeIcon />}
      </span>
    ) : null}

    {/* A <p>, not an <h2>. Heading level is a property of the page this lands
        in, and a primitive that hard-codes one is how a document ends up with
        an h2 before its h1. */}
    <p style={TITLE}>{title}</p>

    {description ? <p style={COPY}>{description}</p> : null}
    {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
  </div>
);

export default EmptyState;
