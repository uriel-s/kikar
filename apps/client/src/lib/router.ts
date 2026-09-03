import React from "react";
import * as ReactRouterDOM from "react-router-dom";

/*
 * Typed re-exports of the slice of react-router-dom v5 this app's
 * TypeScript components use — Link, Route, Redirect, useHistory.
 *
 * react-router-dom@5 ships no bundled types, and its DefinitelyTyped package
 * (@types/react-router-dom, and the @types/react-router it depends on)
 * declares an unpinned "@types/react": "*". In this monorepo that dedupes
 * against whatever @types/react is already resolved at the workspace root —
 * an unrelated 19.x pulled in transitively through apps/server's
 * prisma -> @prisma/studio-core dev tooling — rather than the client's own
 * pinned 18.3.31 (see the @types/react devDependency in
 * apps/client/package.json, added for the same root cause). The mismatch
 * fails every JSX use of a typed react-router-dom component with TS2786:
 * React 19 widened ReactNode to allow bigint, and 18's is not assignable
 * from it.
 *
 * Re-typing the runtime values here, once, against the props each component
 * actually receives is narrower and safer than a monorepo-wide dependency
 * override that would also reach into the totally unrelated
 * prisma-studio-core tree. Every .tsx file imports Link/Route/Redirect/
 * useHistory from here rather than from "react-router-dom" directly, so the
 * cast exists in exactly one place.
 */

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const Link = ReactRouterDOM.Link as unknown as React.FC<LinkProps>;

/** The subset of v5's RouteComponentProps this app's routed pages consume —
 * only ever spread straight through to whatever `component` renders, never
 * read field-by-field here, so there is nothing to gain from recreating the
 * full `match`/`location`/`history` shape by hand. */
export type RouteComponentProps = Record<string, unknown>;

export interface RouteProps {
  path?: string | string[];
  exact?: boolean;
  render?: (props: RouteComponentProps) => React.ReactNode;
}

export const Route = ReactRouterDOM.Route as unknown as React.FC<RouteProps>;

export const Redirect = ReactRouterDOM.Redirect as unknown as React.FC<{ to: string }>;

/** Only `.push` — the one History method any component here calls. */
export interface History {
  push: (path: string) => void;
}

export const useHistory = ReactRouterDOM.useHistory as unknown as () => History;
