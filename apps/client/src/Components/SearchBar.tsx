// SearchBar.tsx
import React, { useRef, useState } from "react";
import { useHistory } from "../lib/router";
import { IoSearchSharp as IoSearchSharpIcon } from "react-icons/io5";
import type { IconBaseProps } from "react-icons";

// Same TS2786 as the one documented in lib/router.ts's header, hitting
// react-icons instead of react-router-dom: IconType's return type is this
// monorepo's mismatched, unpinned React 19 ReactNode (widened to allow
// bigint), which is not assignable to the client's pinned React 18 one. One
// icon, one file — narrow enough not to warrant its own shim module the way
// router.ts's four components did.
const IoSearchSharp = IoSearchSharpIcon as unknown as React.FC<IconBaseProps>;

/*
 * Inline Slate tokens over the .search-* classes this still carries.
 *
 * The reason is the cascade, not taste. index.css styles every bare <input>
 * dark — `background-color: #353945; color: #e4e6eb` — and App.css's
 * .search-input sets no colour of its own, so the field rendered as a 2019 dark
 * slot inside a white pill in the middle of the plaza's pale header. This is
 * the only input on the rebuilt screen that is not a Field, so it borrows
 * Field's exact vocabulary: paper, paper-ink, --radius-control, paper-muted for
 * the border and the accent for focus.
 *
 * The classes STAY. SearchBar is also the navbar's search on the nine screens
 * that have not been rebuilt, where .search-bar still owns its width, and the
 * search screen behind it is not this stage's to rebuild. Inline styles beat an
 * author rule for every property they set — a pseudo-class included, which is
 * how .search-container's :focus-within glow and .search-button's :hover lift
 * are switched off below without touching App.css. A pseudo-class is the one
 * thing an inline style cannot express and also the one thing it always
 * outranks.
 */

const CONTAINER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  overflow: "hidden",
  borderRadius: "var(--radius-control)",
  background: "var(--color-paper)",
  borderStyle: "solid",
  // Constant width and only the colour changes on focus, so nothing inside
  // moves by a pixel. Field's border, to the number.
  borderWidth: 2,
  // .search-container paints a blue glow and a 1% scale on :focus-within. Both
  // are stated away here rather than left to fight the accent ring.
  boxShadow: "none",
  transform: "none",
};

const INPUT: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "9px 12px",
  border: "none",
  background: "transparent",
  color: "var(--color-paper-ink)",
  fontFamily: "inherit",
  fontSize: 15,
  lineHeight: 1.4,
  // The ring belongs to the whole control, not to the input inside it: the
  // select is part of the same box and focusing either has to look the same.
  outline: "none",
};

const SELECT: React.CSSProperties = {
  flexShrink: 0,
  padding: "9px 8px",
  border: "none",
  // A knock-back of the surface's own muted ink rather than the keyline, for
  // the reason PostCard's comment panel gives: a keyline-coloured rule drawn on
  // paper is a rule nobody can see.
  borderLeft: "1px solid color-mix(in oklab, var(--color-paper-muted) 35%, transparent)",
  background: "transparent",
  color: "var(--color-paper-ink)",
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: 1.4,
  cursor: "pointer",
  outline: "none",
  // .search-type keeps 2px off the button, which used to be the gap between a
  // white select and a blue pill. Inside one field it is a 2px sliver of paper.
  marginRight: 0,
};

const BUTTON: React.CSSProperties = {
  flexShrink: 0,
  // Stretch, not centre: the button is the end of the field, so it has to be
  // as tall as the field is however tall the text inside makes that.
  alignSelf: "stretch",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  padding: "0 12px",
  border: "none",
  // Square, because the container's own radius and overflow:hidden are what cut
  // the corner — two radii on one corner is what left .search-button drawing a
  // 30px curve inside a 14px one.
  borderRadius: 0,
  background: "var(--color-accent)",
  color: "var(--color-on-accent)",
  cursor: "pointer",
  // .search-button lifts 2px and re-shadows on hover. Neither belongs on a
  // control welded into the side of a field.
  transform: "none",
  boxShadow: "none",
};

// 20, not the 28 the JSX asked for: 28 in a 40px-tall control is a glyph filling
// its own button. .search-icon's white drop-shadow goes with it — it was there
// to lift the icon off a mid-blue fill.
const ICON_SIZE = 20;
const ICON: React.CSSProperties = { filter: "none" };

const SearchBar = () => {
  const [query, setQuery] = useState<string>("");
  const [searchType, setSearchType] = useState<string>("all"); // Options: all, users, posts
  // :focus-within in state, because an inline style cannot hold a pseudo-class —
  // the same reason Button tracks :focus-visible itself. On the three controls
  // rather than on the box around them: a <div> carrying focus handlers is a
  // non-interactive element with an interaction, which jsx-a11y is right about.
  const [focused, setFocused] = useState<boolean>(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const history = useHistory();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      // Navigate to search results page with query parameters
      history.push(`/search?q=${encodeURIComponent(query)}&type=${searchType}`);
    }
  };

  // relatedTarget is where focus is GOING. Without the containment test the ring
  // drops for a frame every time somebody tabs from the input to the filter —
  // the field has not lost focus there, focus has moved inside it.
  //
  // Spread onto all three of <input>, <select> and <button> below, so onBlur's
  // event has to satisfy every one of their FocusEvent prop types at once —
  // hence the union rather than a single element's type.
  const focus = {
    onFocus: () => setFocused(true),
    onBlur: (
      e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>
    ) => setFocused(Boolean(fieldRef.current?.contains(e.relatedTarget))),
  };

  return (
    <form onSubmit={handleSearch} className="search-bar">
      <div
        ref={fieldRef}
        className="search-container"
        style={{
          ...CONTAINER,
          borderColor: focused ? "var(--color-accent)" : "var(--color-paper-muted)",
        }}
      >
        <input
          {...focus}
          type="text"
          placeholder="Search users and posts..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          className="search-input"
          style={INPUT}
        />
        <select
          {...focus}
          value={searchType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setSearchType(e.target.value)
          }
          className="search-type"
          style={SELECT}
        >
          <option value="all">All</option>
          <option value="users">Users</option>
          <option value="posts">Posts</option>
        </select>
        <button {...focus} type="submit" className="search-button" style={BUTTON}>
          <IoSearchSharp size={ICON_SIZE} className="search-icon" style={ICON} />
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
