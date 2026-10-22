import { describe, expect, it } from 'vitest';
import {
  deriveIssueStatus,
  findRequestTriageComment,
  findSummaryComment,
  requestTriageComments,
  summaryComments,
  isRequestTriageComment,
  isSummaryComment,
  firstHeading,
  reportedTiming,
  NO_SUMMARY_TEXT,
  REQUEST_TRIAGE_HEADING,
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

describe('issue status derivation', () => {
  it('shows untagged and yolo:request-only open issues as Request open and maps managed state labels', () => {
    const untagged = deriveIssueStatus(issue({ labels: ['bug'] }));
    expect(untagged.label).toBe('Request open');
    expect(untagged.needsReconciliation).toBe(false);
    expect(untagged.note).toMatch(/does not mean an agent has read or scheduled/i);
    expect(labelNames(issue({ labels: ['bug'] }))).toEqual(['bug']);

    const requestOnly = deriveIssueStatus(issue({ labels: ['yolo:request'] }));
    expect(requestOnly.label).toBe('Request open');
    expect(requestOnly.needsReconciliation).toBe(false);

    for (const [stateLabel, expected] of [
      ['yolo:state:queued', 'Planned'],
      ['yolo:state:active', 'In progress'],
      ['yolo:state:waiting', 'Waiting'],
      ['yolo:state:deferred', 'Postponed'],
    ] as const) {
      const status = deriveIssueStatus(issue({ labels: ['yolo:work', stateLabel] }));
      expect(status.label).toBe(expected);
      expect(status.needsReconciliation).toBe(false);
    }
  });

  it('flags missing, conflicting, or orphaned workflow state labels as needing reconciliation', () => {
    const missingState = deriveIssueStatus(issue({ labels: ['yolo:work'] }));
    expect(missingState.label).toBe('Status needs reconciliation');
    expect(missingState.rawLabels).toEqual(['yolo:work']);

    const duplicateState = deriveIssueStatus(
      issue({ labels: ['yolo:work', 'yolo:state:queued', 'yolo:state:active'] }),
    );
    expect(duplicateState.label).toBe('Status needs reconciliation');
    expect(duplicateState.note).toContain('yolo:state:active');

    const orphanState = deriveIssueStatus(issue({ labels: ['yolo:state:waiting'] }));
    expect(orphanState.label).toBe('Status needs reconciliation');
    expect(orphanState.note).toContain('yolo:work');
  });

  it('derives closed issue status from state_reason and flags leftover state labels', () => {
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'not_planned' })).label).toBe('Not planned');
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'duplicate' })).label).toBe('Duplicate');
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'completed' })).label).toBe('Closed');
    expect(
      deriveIssueStatus(issue({ state: 'closed', state_reason: 'completed', labels: ['yolo:request'] })).label,
    ).toBe('Closed');

    const completedWork = deriveIssueStatus(
      issue({ state: 'closed', state_reason: 'completed', labels: ['yolo:work'] }),
    );
    expect(completedWork.label).toBe('Completed (reported)');
    expect(completedWork.note).toMatch(/does not mean the change is available/i);

    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: null })).label).toBe(
      'Closed — reason unavailable',
    );
    expect(deriveIssueStatus(issue({ state: 'closed', state_reason: 'replicated' })).label).toBe(
      'Closed — reason unavailable',
    );

    const leftover = deriveIssueStatus(
      issue({ state: 'closed', state_reason: 'completed', labels: ['yolo:state:active'] }),
    );
    expect(leftover.needsReconciliation).toBe(true);
    expect(leftover.note).toContain('yolo:state:active');
  });
});

describe('reported summary and request triage detection', () => {
  const comment = (over: Partial<CommentLike>): CommentLike => ({ id: 1, body: '', ...over });

  it('requires the first heading outside code fences to be "## YOLO status" and picks the newest', () => {
    expect(isSummaryComment(comment({ body: '## YOLO status\n\nOutcome: shipped' }))).toBe(true);
    expect(isSummaryComment(comment({ body: 'Some preamble\n\n## YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '# YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '### YOLO status\n' }))).toBe(false);
    expect(isSummaryComment(comment({ body: '## Yolo Status\n' }))).toBe(true);
    expect(isSummaryComment(comment({ body: '## Plan\n' }))).toBe(false);
    expect(firstHeading('\n\n## YOLO status')).toEqual({ level: 2, text: 'YOLO status' });
    expect(isSummaryComment(comment({ body: 'Example:\n\n```md\n## YOLO status\n```\n' }))).toBe(false);
    expect(firstHeading('```\n## YOLO status\n```')).toBeNull();
    expect(isSummaryComment(comment({ body: '## YOLO status\n\n```md\n## Plan\n```\n' }))).toBe(true);

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

  it('detects "## YOLO request" triage comments separately from "## YOLO status" summaries', () => {
    expect(REQUEST_TRIAGE_HEADING).toBe('## YOLO request');
    const triage = comment({ body: '## YOLO request\n\nInterpretation: …\nTiming: next week' });
    expect(isSummaryComment(triage)).toBe(false);
    expect(summaryComments([triage])).toEqual([]);
    expect(reportedTiming(triage)).toBeNull();

    expect(isRequestTriageComment(comment({ body: '## YOLO request\n\nAdmitted into #175.' }))).toBe(true);
    expect(isRequestTriageComment(comment({ body: '## Yolo Request\n\nDeferred.' }))).toBe(true);
    expect(isRequestTriageComment(comment({ body: 'Preamble\n\n## YOLO request\n' }))).toBe(false);
    expect(isRequestTriageComment(comment({ body: '```md\n## YOLO request\n```' }))).toBe(false);
    expect(isRequestTriageComment(comment({ body: '## YOLO status\n\nOutcome: shipped.' }))).toBe(false);

    const comments = [
      comment({ id: 1, body: '## YOLO request\n\nFirst triage', updated_at: '2026-01-01T00:00:00Z' }),
      comment({ id: 2, body: 'ordinary comment', updated_at: '2026-02-01T00:00:00Z' }),
      comment({ id: 3, body: '## YOLO request\n\nUpdated triage', updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(findRequestTriageComment(comments)?.id).toBe(3);
    expect(requestTriageComments(comments).map((item) => item.id)).toEqual([1, 3]);
    expect(findRequestTriageComment([comment({ id: 2, body: 'ordinary' })])).toBeNull();
  });

  it('extracts reportedTiming only from non-fenced summary prose', () => {
    expect(reportedTiming(comment({ body: '## YOLO status\n\n## Timing\n\nNext week' }))).toBe('Next week');
    expect(reportedTiming(comment({ body: '## YOLO status\n\nOutcome: shipped' }))).toBeNull();
    expect(reportedTiming(null)).toBeNull();
    expect(reportedTiming(comment({ body: '## YOLO status\n\n- Timing: not estimated' }))).toBe(
      'Timing: not estimated',
    );
    expect(
      reportedTiming(comment({ body: '## YOLO status\n\nOutcome: shipped.\nTiming: delivered 2026-10-07.' })),
    ).toBe('Timing: delivered 2026-10-07.');
    expect(reportedTiming(comment({ body: '## YOLO status\n\nOutcome: done. It will be ready soon.' }))).toBeNull();
    expect(
      reportedTiming(
        comment({
          body: '## YOLO status\n\nOutcome: not yet delivered.\n\n```text\nTiming: delivered 2026-10-07.\n```\n',
        }),
      ),
    ).toBeNull();
    expect(reportedTiming(comment({ body: '## YOLO status\n\n    Timing: delivered 2026-10-07.\n' }))).toBeNull();
  });
});
