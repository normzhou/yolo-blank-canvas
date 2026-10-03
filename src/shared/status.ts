/**
 * Display compatibility for GitHub records.
 *
 * This module only renders what GitHub already says. It never infers scheduling,
 * admission, delivery, or availability: an untagged issue is simply "Request
 * open", and a closed issue is never "available in this browser".
 */

export const MANAGED_WORK_LABEL = 'yolo:work';
export const STATE_LABELS = {
  'yolo:state:queued': 'Planned',
  'yolo:state:active': 'In progress',
  'yolo:state:waiting': 'Waiting',
  'yolo:state:deferred': 'Postponed',
} as const;

export type StatusTone = 'neutral' | 'progress' | 'waiting' | 'closed' | 'problem';

export interface IssueLike {
  number: number;
  state: string;
  state_reason?: string | null;
  labels?: Array<{ name?: string } | string> | null;
}

export interface DerivedStatus {
  /** Stable machine key for tests and styling. */
  key: string;
  /** Text shown to the user (status never relies on colour alone). */
  label: string;
  tone: StatusTone;
  /** Raw label names involved, shown when something does not add up. */
  rawLabels: string[];
  /** True when labels contradict each other or are leftovers on a closed issue. */
  needsReconciliation: boolean;
  /** Short explanation of what was observed. */
  note?: string;
}

export function labelNames(issue: IssueLike): string[] {
  return (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

const RECONCILIATION = 'Status needs reconciliation';

export function deriveIssueStatus(issue: IssueLike): DerivedStatus {
  const labels = labelNames(issue);
  const isOpen = String(issue.state).toLowerCase() !== 'closed';
  const hasWork = labels.includes(MANAGED_WORK_LABEL);
  const stateLabels = labels.filter((name) => name in STATE_LABELS);
  const rawLabels = labels.filter((name) => name === MANAGED_WORK_LABEL || name in STATE_LABELS);

  if (isOpen) {
    if (stateLabels.length > 1) {
      return {
        key: 'needs_reconciliation',
        label: RECONCILIATION,
        tone: 'problem',
        rawLabels,
        needsReconciliation: true,
        note: `More than one state label: ${stateLabels.join(', ')}.`,
      };
    }
    if (stateLabels.length === 1 && !hasWork) {
      return {
        key: 'needs_reconciliation',
        label: RECONCILIATION,
        tone: 'problem',
        rawLabels,
        needsReconciliation: true,
        note: `State label without ${MANAGED_WORK_LABEL}: ${stateLabels[0]}.`,
      };
    }
    if (hasWork && stateLabels.length === 0) {
      return {
        key: 'needs_reconciliation',
        label: RECONCILIATION,
        tone: 'problem',
        rawLabels,
        needsReconciliation: true,
        note: `${MANAGED_WORK_LABEL} without a state label.`,
      };
    }
    if (stateLabels.length === 1) {
      return {
        key: stateLabels[0].replace('yolo:state:', ''),
        label: STATE_LABELS[stateLabels[0] as keyof typeof STATE_LABELS],
        tone: stateLabels[0] === 'yolo:state:active' ? 'progress' : stateLabels[0] === 'yolo:state:waiting' ? 'waiting' : 'neutral',
        rawLabels,
        needsReconciliation: false,
      };
    }
    // Untagged open work is normal before admission; nothing is implied.
    return {
      key: 'request_open',
      label: 'Request open',
      tone: 'neutral',
      rawLabels,
      needsReconciliation: false,
      note: 'No workflow labels yet. This does not mean an agent has read or scheduled it.',
    };
  }

  const leftovers = stateLabels;
  const needsReconciliation = leftovers.length > 0;
  const reason = normalizeReason(issue.state_reason);
  if (reason === 'not_planned') {
    return { key: 'not_planned', label: 'Not planned', tone: 'closed', rawLabels, needsReconciliation, note: leftoverNote(leftovers) };
  }
  if (reason === 'duplicate') {
    return { key: 'duplicate', label: 'Duplicate', tone: 'closed', rawLabels, needsReconciliation, note: leftoverNote(leftovers) };
  }
  if (reason === 'completed') {
    if (hasWork) {
      return {
        key: 'completed_reported',
        label: 'Completed (reported)',
        tone: 'closed',
        rawLabels,
        needsReconciliation,
        note:
          leftoverNote(leftovers) ??
          'Reported by the workflow. Closure alone does not mean the change is available in this browser.',
      };
    }
    return {
      key: 'closed',
      label: 'Closed',
      tone: 'closed',
      rawLabels,
      needsReconciliation,
      note: leftoverNote(leftovers),
    };
  }
  return {
    key: 'closed_unknown_reason',
    label: 'Closed — reason unavailable',
    tone: 'closed',
    rawLabels,
    needsReconciliation,
    note: leftoverNote(leftovers) ?? 'GitHub recorded no closure reason.',
  };
}

function leftoverNote(leftovers: string[]): string | undefined {
  if (leftovers.length === 0) return undefined;
  return `Workflow state labels left on a closed issue: ${leftovers.join(', ')}.`;
}

function normalizeReason(reason: string | null | undefined): string | null {
  if (typeof reason !== 'string') return null;
  const value = reason.trim().toLowerCase();
  if (value === 'completed' || value === 'not_planned' || value === 'duplicate') return value;
  return null;
}

export const NO_SUMMARY_TEXT = 'No progress summary yet.';
export const NO_TIMING_TEXT = 'Delivery timing not yet estimated.';
export const SUMMARY_HEADING = '## YOLO status';

export interface CommentLike {
  id: number;
  body?: string | null;
  updated_at?: string;
  created_at?: string;
  html_url?: string;
  user?: { login?: string } | null;
}

/** The comment's first Markdown heading, if the body starts with one. */
export function firstHeading(body: string | undefined | null): { level: number; text: string } | null {
  if (typeof body !== 'string') return null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) return { level: match[1].length, text: match[2].trim() };
    // Text before any heading means this comment does not open with a heading.
    return null;
  }
  return null;
}

export function isSummaryComment(comment: CommentLike): boolean {
  const heading = firstHeading(comment.body);
  if (!heading || heading.level !== 2) return false;
  return heading.text.toLowerCase() === 'yolo status';
}

export function timestampOf(comment: CommentLike): number {
  const value = Date.parse(comment.updated_at || comment.created_at || '');
  return Number.isNaN(value) ? 0 : value;
}

/** The most recently updated matching comment; all matching comments stay in the timeline. */
export function findSummaryComment(comments: CommentLike[] | undefined | null): CommentLike | null {
  const matches = (comments ?? []).filter(isSummaryComment);
  if (matches.length === 0) return null;
  return matches.reduce((latest, comment) => (timestampOf(comment) >= timestampOf(latest) ? comment : latest));
}

export function summaryComments(comments: CommentLike[] | undefined | null): CommentLike[] {
  return (comments ?? []).filter(isSummaryComment);
}

const TIMING_HEADING = /^(timing|when|delivery timing|estimated delivery|schedule)\b/i;

/**
 * Timing text is only shown when the summary actually states it. Nothing is
 * estimated from prose.
 */
export function reportedTiming(summary: CommentLike | null): string | null {
  if (!summary || typeof summary.body !== 'string') return null;
  const lines = summary.body.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!/^#{1,6}\s+/.test(line)) continue;
    const headingText = line.replace(/^#{1,6}\s+/, '').trim();
    if (!TIMING_HEADING.test(headingText)) continue;
    const body = collectUntilHeading(lines, index + 1).trim();
    if (body) return body;
  }
  const inline = lines.find((line) => TIMING_HEADING.test(line.replace(/^[-*]\s*/, '').trim()));
  if (inline) {
    const value = inline.replace(/^[-*]\s*/, '').replace(/^#{1,6}\s+/, '').trim();
    if (value && value !== 'Timing' && value.toLowerCase() !== 'timing') return value;
  }
  return null;
}

function collectUntilHeading(lines: string[], start: number): string {
  const out: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index].trim())) break;
    out.push(lines[index]);
  }
  return out.join('\n');
}