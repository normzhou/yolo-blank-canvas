import { describe, expect, it } from 'vitest';
import {
  buildListRows,
  compareByUpdatedDesc,
  isConfirmedByList,
  MAX_RECONCILE_ATTEMPTS,
  retryDelayMs,
  shouldRetryFor,
  unconfirmedRequests,
} from '../src/shared/listReconciliation';
import type { IssueSummary } from '../src/client/api';

function issue(number: number, updated: string, title = `issue ${number}`): IssueSummary {
  return { number, title, state: 'open', updated_at: updated, labels: [] };
}

/**
 * GitHub's issue list endpoint is eventually consistent, so a freshly created
 * request can be missing from it while a direct read returns it. These cases
 * pin the behaviour the product depends on: a request the user just made is
 * never silently dropped, and the app never claims list membership it lacks.
 */
describe('list reconciliation for just-created requests', () => {
  it('treats a created request missing from the list as unconfirmed, not lost', () => {
    const created = [issue(12, '2026-10-05T15:17:44Z')];
    const items = [issue(5, '2026-10-03T23:55:18Z'), issue(4, '2026-10-03T23:53:10Z')];
    expect(isConfirmedByList(created[0], items)).toBe(false);
    expect(unconfirmedRequests(created, items).map((i) => i.number)).toEqual([12]);
    expect(shouldRetryFor(created, items)).toBe(true);
  });

  it('stops retrying once the list confirms the created request', () => {
    const created = [issue(12, '2026-10-05T15:17:44Z')];
    const items = [issue(12, '2026-10-05T15:17:44Z'), issue(5, '2026-10-03T23:55:18Z')];
    expect(isConfirmedByList(created[0], items)).toBe(true);
    expect(unconfirmedRequests(created, items)).toEqual([]);
    expect(shouldRetryFor(created, items)).toBe(false);
  });

  it('keeps every unconfirmed request visible instead of dropping it', () => {
    const created = [issue(12, '2026-10-05T15:17:44Z'), issue(13, '2026-10-05T15:20:00Z')];
    const rows = buildListRows([issue(5, '2026-10-03T23:55:18Z')], created);
    expect(rows.map((row) => [row.issue.number, row.kind])).toEqual([
      [13, 'unconfirmed'],
      [12, 'unconfirmed'],
      [5, 'listed'],
    ]);
  });

  it('marks the row unconfirmed rather than implying it is in the list', () => {
    const created = [issue(12, '2026-10-05T15:17:44Z')];
    const rows = buildListRows([], created);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('unconfirmed');
  });

  it('does not duplicate a created request once the list includes it', () => {
    const created = [issue(12, '2026-10-05T15:17:44Z')];
    const items = [issue(12, '2026-10-05T15:17:44Z')];
    const rows = buildListRows(items, created);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('listed');
  });

  it('orders rows by the list rule: newest updated first, higher number breaking ties', () => {
    const rows = buildListRows(
      [issue(4, '2026-10-03T23:53:10Z'), issue(5, '2026-10-03T23:55:18Z')],
      [issue(12, '2026-10-05T15:17:44Z')],
    );
    expect(rows.map((row) => row.issue.number)).toEqual([12, 5, 4]);
  });

  it('sorts by updated time descending, higher number first on ties', () => {
    // Newer updated time first.
    expect(compareByUpdatedDesc(issue(1, '2026-01-02'), issue(2, '2026-01-01'))).toBeLessThan(0);
    // Equal timestamps stay deterministic: the higher number sorts first.
    expect(compareByUpdatedDesc(issue(3, '2026-01-01'), issue(4, '2026-01-01'))).toBeGreaterThan(0);
    // An absent timestamp must not throw or float to the top; it sorts last.
    expect(compareByUpdatedDesc({ number: 9, title: 'x', state: 'open' }, issue(8, '2026-01-01'))).toBeGreaterThan(0);
  });

  it('bounds reconciliation so a slow list cannot spin the server', () => {
    expect(MAX_RECONCILE_ATTEMPTS).toBeGreaterThan(0);
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(99)).toBe(retryDelayMs(MAX_RECONCILE_ATTEMPTS));
    expect(retryDelayMs(0)).toBe(retryDelayMs(1));
  });
});
