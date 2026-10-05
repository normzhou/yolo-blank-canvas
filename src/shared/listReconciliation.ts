/**
 * List reconciliation for requests the user just created.
 *
 * GitHub's issue *list* endpoint is eventually consistent: a freshly created
 * issue can be absent from list queries for seconds or, as observed in this
 * repository, well over twenty seconds, while a direct read of the same issue
 * returns it immediately. The app therefore cannot treat "the list does not
 * contain it" as "the request was not created".
 *
 * A just-created request is kept visible as an explicitly unconfirmed entry
 * until the list confirms it. The app never invents list membership and never
 * silently drops a request the user just made.
 */
import type { IssueSummary } from '../client/api';

export const UNCONFIRMED_LABEL = 'Not listed yet';
export const UNCONFIRMED_NOTE =
  'Created successfully. GitHub’s issue list has not caught up yet, so this request is shown from the confirmed create result until it appears in the list.';

export type ListRow =
  | { kind: 'listed'; issue: IssueSummary }
  | { kind: 'unconfirmed'; issue: IssueSummary };

/** Orders rows newest-updated first, matching the list the server returns. */
export function compareByUpdatedDesc(a: IssueSummary, b: IssueSummary): number {
  const left = Date.parse(a.updated_at ?? '') || 0;
  const right = Date.parse(b.updated_at ?? '') || 0;
  if (left !== right) return right - left;
  return b.number - a.number;
}

/**
 * True when the list confirms this created request. The server only reports
 * issues, so any returned number is authoritative.
 */
export function isConfirmedByList(issue: IssueSummary, items: readonly IssueSummary[]): boolean {
  return items.some((item) => item.number === issue.number);
}

/** Created requests the list has not caught up with, oldest number last. */
export function unconfirmedRequests(
  created: readonly IssueSummary[],
  items: readonly IssueSummary[],
): IssueSummary[] {
  return created
    .filter((issue) => !isConfirmedByList(issue, items))
    .sort((a, b) => a.number - b.number);
}

/**
 * The rows to render: listed issues plus any created request the list has not
 * confirmed, ordered by the list's own newest-updated rule. Unconfirmed rows
 * stay distinguishable, so the list never claims membership it does not have.
 */
export function buildListRows(
  items: readonly IssueSummary[],
  created: readonly IssueSummary[] = [],
): ListRow[] {
  const listed: ListRow[] = items.map((issue) => ({ kind: 'listed', issue }));
  const unconfirmed: ListRow[] = unconfirmedRequests(created, items).map((issue) => ({
    kind: 'unconfirmed',
    issue,
  }));
  return [...listed, ...unconfirmed].sort((a, b) => compareByUpdatedDesc(a.issue, b.issue));
}

/**
 * Whether another list read is worth scheduling: only while a created request
 * is still unconfirmed.
 */
export function shouldRetryFor(created: readonly IssueSummary[], items: readonly IssueSummary[]): boolean {
  return unconfirmedRequests(created, items).length > 0;
}

/** Backoff for those retries, bounded so a slow list cannot spin the server. */
export function retryDelayMs(attempt: number): number {
  const capped = Math.min(Math.max(attempt, 1), 6);
  return 5_000 * capped;
}

export const MAX_RECONCILE_ATTEMPTS = 6;
