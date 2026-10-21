/**
 * Where the canvas and the Requests workflow are, as an addressable location
 * (#132, #165).
 *
 * The workflow's central object — a request — had no address. It could not be
 * linked, bookmarked, reloaded into, or reached with the browser's back button.
 * For a project whose first Charter constraint is "GitHub holds the record of
 * work", an unaddressable request is a structural contradiction rather than a
 * missing feature.
 *
 * Canvas content has the same problem: a gallery app is a place, so it gets a
 * location too. The two locations compose, because Requests is an overlay over
 * whatever canvas is showing.
 *
 * ## Shape
 *
 * | URL | Meaning |
 * | --- | --- |
 * | *(none)* | The blank canvas is the resting state. The workflow is closed. |
 * | `?app=<id>` | That canvas app is open; Requests is closed. |
 * | `?panel` | Requests is open on the list over the current canvas. |
 * | `?panel=new` | Requests is open on the request composer. |
 * | `?panel=<n>` | Requests is open on request `n`. |
 * | `?app=<id>&panel=<n>` | Request `n` opening over that app. |
 * | `?app=<id>&panel=new` | The composer, carrying that app's context (#169). |
 *
 * `?panel=123` is the linkable form, kept short because it is the one people
 * paste into an issue. Absence of the parameter is the resting state, which
 * keeps the default URL clean and makes "no route" mean "nothing open".
 *
 * ## What is deliberately not routed
 *
 * Drafts, the open/closed filter, polling timestamps and the palette's open
 * state are decisions about the *session*, not locations. Putting them in the
 * URL would mean a keystroke or a poll pushed a history entry, and a shared
 * link would carry someone else's filter. The palette is transient UI; it does
 * not survive a reload, and that is correct.
 */

export type RouteTarget = { name: 'list' } | { name: 'new' } | { name: 'detail'; number: number };

export type Route = { open: boolean; target: RouteTarget; app: string | null };

const PANEL = 'panel';
const APP = 'app';

/** An app id is a URL token, not a path: no slashes, dots or escapes. */
const APP_ID = /^[a-z][a-z0-9-]*$/;

function readApp(raw: string | null): string | null {
  return raw !== null && APP_ID.test(raw) ? raw : null;
}

/**
 * Parse a query string. Anything unrecognised falls back to the open list rather
 * than to the resting state: a malformed link should still show the workflow
 * rather than silently discarding where someone meant to go.
 *
 * An unknown app token is left for the registry to reject. The route layer knows
 * the shape of an id, not which apps exist.
 */
export function readRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const app = readApp(params.get(APP));
  const raw = params.get(PANEL);
  if (raw === null) return { open: false, target: { name: 'list' }, app };
  if (raw === 'new') return { open: true, target: { name: 'new' }, app };
  if (/^[1-9]\d*$/.test(raw)) return { open: true, target: { name: 'detail', number: Number(raw) }, app };
  return { open: true, target: { name: 'list' }, app };
}

/**
 * The URL for a location. `null` is the resting state for Requests; `app` names
 * the canvas underneath it. Parameters are written in the order a reader scans
 * them: the place, then the overlay on it.
 */
export function routeUrl(target: RouteTarget | null, pathname = '/', app: string | null = null): string {
  const parts: string[] = [];
  if (app) parts.push(`${APP}=${encodeURIComponent(app)}`);
  if (target !== null) {
    if (target.name === 'list') parts.push(PANEL);
    else if (target.name === 'new') parts.push(`${PANEL}=new`);
    else parts.push(`${PANEL}=${target.number}`);
  }
  return parts.length === 0 ? pathname : `${pathname}?${parts.join('&')}`;
}

/** The request location a `Route` names, for pushing or replacing history. */
export function routeTarget(route: Route): RouteTarget | null {
  return route.open ? route.target : null;
}
