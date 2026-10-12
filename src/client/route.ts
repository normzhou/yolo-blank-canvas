/**
 * Where the Requests workflow is, as an addressable location (#132).
 *
 * The workflow's central object — a request — had no address. It could not be
 * linked, bookmarked, reloaded into, or reached with the browser's back button.
 * For a project whose first Charter constraint is "GitHub holds the record of
 * work", an unaddressable request is a structural contradiction rather than a
 * missing feature.
 *
 * ## Shape
 *
 * | URL | Meaning |
 * | --- | --- |
 * | *(none)* | The canvas is the resting state. The workflow is closed. |
 * | `?panel` | The workflow is open on the list. |
 * | `?panel=new` | The workflow is open on the request composer. |
 * | `?panel=<n>` | The workflow is open on request `n`. |
 *
 * `?panel=123` is the linkable form, kept short because it is the one people
 * paste into an issue. Absence of the parameter is the resting state, which
 * keeps the default URL clean and makes "no route" mean "nothing open".
 *
 * ## What is deliberately not routed
 *
 * Drafts, the open/closed filter and polling timestamps are decisions about the
 * *session*, not locations. Putting them in the URL would mean a keystroke or a
 * poll pushed a history entry, and a shared link would carry someone else's
 * filter. Nothing here encodes them.
 */

export type RouteTarget = { name: 'list' } | { name: 'new' } | { name: 'detail'; number: number };

export type Route = { open: boolean; target: RouteTarget };

const PANEL = 'panel';

/**
 * Parse a query string. Anything unrecognised falls back to the open list rather
 * than to the resting state: a malformed link should still show the workflow
 * rather than silently discarding where someone meant to go.
 */
export function readRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const raw = params.get(PANEL);
  if (raw === null) return { open: false, target: { name: 'list' } };
  if (raw === 'new') return { open: true, target: { name: 'new' } };
  if (/^[1-9]\d*$/.test(raw)) return { open: true, target: { name: 'detail', number: Number(raw) } };
  return { open: true, target: { name: 'list' } };
}

/** The URL for a location. `null` is the resting state. */
export function routeUrl(target: RouteTarget | null, pathname = '/'): string {
  if (target === null) return pathname;
  if (target.name === 'list') return `${pathname}?${PANEL}`;
  if (target.name === 'new') return `${pathname}?${PANEL}=new`;
  return `${pathname}?${PANEL}=${target.number}`;
}

/** The location a `Route` names, for pushing or replacing history. */
export function routeTarget(route: Route): RouteTarget | null {
  return route.open ? route.target : null;
}