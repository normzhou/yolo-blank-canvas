import { describe, expect, it } from 'vitest';
import {
  deriveIssueStatus,
  findSummaryComment,
  summaryComments,
  isSummaryComment,
  firstHeading,
  reportedTiming,
  NO_SUMMARY_TEXT,
  labelNames,
  type CommentLike,
  type IssueLike,
} from '../src/shared/status';

function issue(overrides: Partial<IssueLike> & { labels?: string[] }): IssueLike {
  return {
    number: 1,
    state: 'open',
    state_reason: null,
    ...overrides,
    labels: (overrides.labels ?? []).map((name) => ({ name })),
  } as IssueLike;
}

describe('open issue status', () => {
  it('shows an untagged open issue as Request open without implying scheduling', () => {
    const status = deriveIssueStatus(issue({ labels: ['bug'] }));
    expect(status.label).toBe('Request open');
    expect(status.needsReconciliation).toBe(false);
    expect(status.note).toMatch(/does not mean an agent has read or scheduled/i);
    // Unrelated labels stay visible.
    expect(labelNames(issue({ labels: ['bug'] }))).toEqual(['bug']);
  });

  it.each([
    ['yolo:state:queued', 'Planned'],
    ['yolo:state:active', 'In progress'],
    ['yolo:state:waiting', 'Waiting'],
    ['yolo:state:deferred', 'Postponed'],
  ])('maps %s to %s for managed work', (stateLabel, expected) => {
    const status = deriveIssueStatus(issue({ labels: ['yolo:work', stateLabel] }));
    expect(status.label).toBe(expected);
    expect(status.needsReconciliation).toBe(false);
  });
});

describe('status needing reconciliation', () => {
  it('flags managed work with no state label', () => {
    const status = deriveIssueStatus(issue({ labels: ['yolo:work'] }));
    expect(status.label).toBe('Status needs reconciliation');
    expect(status.rawLabels).toEqual(['yolo:work']);
  });

  it('flags managed work with several state labels', () => {
    const status = deriveIssueStatus(issue({ labels: ['yolo:work', 'yolo:state:queued', 'yolo:state:active'] }));
    expect(status.label).toBe('Status needs reconciliation');
    expect(status.note).toContain('yolo:state:active');
  });

  it('flags a state label without yolo:work', () => {
    const status = deriveIssueStatus(issue({ labels: ['yolo:state:waiting'] }));
    expect(status.label).toBe('Status needs reconciliation');
    expect(status.note).toContain('yolo:work');
  });
});

describe('closed issue status', () => {
  it('shows the GitHub closure reason', () => {
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'not_planned' })).label).toBe('Not planned');
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'duplicate' })).label).toBe('Duplicate');
  });

  it('marks completed managed work as reported, not available in this browser', () => {
    const status = deriveIssueStatus(issue({ state: 'closed', state_reason: 'completed', labels: ['yolo:work'] }));
    expect(status.label).toBe('Completed (reported)');
    expect(status.note).toMatch(/does not mean the change is available/i);
  });

  it('shows a completed untagged conversation as Closed', () => {
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'completed' })).label).toBe('Closed');
  });

  it('falls back honestly when the reason is unknown', () => {
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: null })).label).toBe('Closed — reason unavailable');
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'replicated' })).label).toBe(
      'Closed — reason unavailable',
    );
  });

  it('shows leftover workflow labels on a closed issue as unreconciled', () => {
    const status = deriveIssueStatus(issue({ state: 'closed', state_reason: 'completed', labels: ['yolo:state:active'] }));
    expect(status.needsReconciliation).toBe(true);
    expect(status.note).toContain('yolo:state:active');
  });
});

describe('reported summary detection', () => {
  const comment = (over: Partial<CommentLike>): CommentLike => ({ id: 1, body: '', ...over });

  it('requires the first heading to be exactly "## YOLO status"', () => {
    expect(isSummaryComment(comment({ body: '## YOLO status\n\nOutcome: shipped' }))).toBe(true);
    expect(isSummaryComment(comment({ body: 'Some preamble\n\n## YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '# YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '### YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '## Yolo Status\n' }))).toBe(true);
    expect(isSummaryComment(comment({ body: '## Plan\n' }))).toBe(false);
    expect(firstHeading('\n\n## YOLO status')).toEqual({ level: 2, text: 'YOLO status' });
  });

  it('identifies the most recently updated match and keeps the others accessible', () => {
    const comments = [
      comment({ id: 1, body: '## YOLO status\n\nOutcome: first', updated_at: '2026-01-01T00:00:00Z' }),
      comment({ id: 2, body: 'hello', updated_at: '2026-02-01T00:00:00Z' }),
      comment({ id: 3, body: '## YOLO status\n\nOutcome: newest', updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(findSummaryComment(comments)?.id).toBe(3);
    expect(summaryComments(comments).map((item) => item.id)).toEqual([1, 3]);
    expect(findSummaryComment(comments.filter((item) => item.id === 2))).toBeNull();
    expect(NO_SUMMARY_TEXT).toBe('No progress summary yet.');
  });

  it('reads timing only when the summary states it', () => {
    const withTiming = comment({ body: '## YOLO status\n\n## Timing\n\nNext week' });
    const withoutTiming = comment({ body: '## YOLO status\n\nOutcome: shipped' });
    expect(reportedTiming(withTiming)).toBe('Next week');
    expect(reportedTiming(withoutTiming)).toBeNull();
    expect(reportedTiming(null)).toBeNull();
    expect(reportedTiming(comment({ body: '## YOLO status\n\n- Timing: not estimated' }))).toBe('Timing: not estimated');
  });

  it('never invents a delivery estimate from ordinary prose', () => {
    const prose = comment({ body: '## YOLO status\n\nOutcome: done. It will be ready soon.' });
    expect(reportedTiming(prose)).toBeNull();
  });
});