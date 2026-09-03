import React from "react";
import * as ReactRouterDOM from "react-router-dom";

/*
 * Typed re-exports of the slice of react-router-dom v5 this app's
 * TypeScript components use — Link, Route, Redirect, useHistory, Switch,
 * BrowserRouter.
 *
 * react-router-dom@5 ships no bundled types, and its DefinitelyTyped package
 * (@types/react-router-dom, and the @types/react-router it depends on)
 * declares an unpinned "@types/react": "*", which resolves against whatever
 * @types/react is nearest on the node_modules walk from wherever
 * @types/react-router ends up hoisted. When this shim was written that was an
 * unrelated 19.x pulled in transitively through apps/server's
 * prisma -> @prisma/studio-core dev tooling, rather than the client's own
 * pinned 18.3.31 (see the @types/react devDependency in
 * apps/client/package.json, added for the same root cause) — and the mismatch
 * failed every JSX use of a typed react-router-dom component with TS2786:
 * React 19 widened ReactNode to allow bigint, and 18's is not assignable
 * from it.
 *
 * Adding @types/react-dom alongside @types/react (stage 4f) changed how npm
 * hoists this tree — the root @types/react now resolves to 18.3.31 too — so
 * the exact conflict described above may no longer reproduce. That has not
 * been re-verified end to end (removing this shim would touch every .tsx file
 * that imports from it, which is out of scope for the section that noticed
 * the hoisting shift); until someone does that check deliberately, re-typing
 * the runtime values here, once, against the props each component actually
 * receives remains narrower and safer than trusting the current hoist to
 * hold across the next `npm install`. Every .tsx file imports Link/Route/
 * Redirect/useHistory from here rather than from "react-router-dom" directly,
 * so the cast exists in exactly one place.
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
  component?: React.ComponentType<RouteComponentProps>;
  // App.tsx's OffPlaza wrapper uses the v5 "render children directly" form —
  // <Route>{children}</Route>, no path/render/component — so this needs to be
  // an explicit prop rather than relying on React.FC's (removed, in this
  // @types/react version) implicit PropsWithChildren.
  children?: React.ReactNode;
}

export const Route = ReactRouterDOM.Route as unknown as React.FC<RouteProps>;

export const Redirect = ReactRouterDOM.Redirect as unknown as React.FC<{
  to: string;
  from?: string;
}>;

/** Only `.push` — the one History method any component here calls. */
export interface History {
  push: (path: string) => void;
}

export const useHistory = ReactRouterDOM.useHistory as unknown as () => History;

export const Switch = ReactRouterDOM.Switch as unknown as React.FC<{
  children?: React.ReactNode;
}>;

export const BrowserRouter = ReactRouterDOM.BrowserRouter as unknown as React.FC<{
  children?: React.ReactNode;
}>;
