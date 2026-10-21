import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';

/**
 * Creates one ordinary issue. No labels, priorities, or assignees are added, and
 * the draft is cleared only after GitHub confirms the issue.
 */
export function NewRequestView({
  draft,
  onDraftChange,
  onCancel,
  onCreated,
}: {
  draft: { title: string; body: string };
  onDraftChange: (next: { title: string; body: string }) => void;
  onCancel: () => void;
  onCreated: (issue: IssueSummary) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [touched, setTouched] = useState(false);
  const submittingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyCaretPlaced = useRef(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  /**
   * #169: the body can open with a visible app-context line (or a restored
   * draft). Tabbing into it must not select the whole value and let the first
   * keystroke replace it; put the caret after the existing text on first focus.
   * A deliberate click inside the text keeps its position.
   */
  function focusBody(event: React.FocusEvent<HTMLTextAreaElement>) {
    if (bodyCaretPlaced.current) return;
    bodyCaretPlaced.current = true;
    const body = event.currentTarget;
    if (body.value.length > 0 && body.selectionStart === 0) {
      body.setSelectionRange(body.value.length, body.value.length);
    }
  }

  const titleMissing = draft.title.trim().length === 0;

  async function doSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createIssue(draft.title, draft.body);
      onDraftChange({ title: '', body: '' });
      onCreated(result.issue);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' }));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleMissing) return;
    // A double click must not create two issues.
    void doSubmit();
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>New request</h2>
      <ErrorNotice
        error={error}
        onRetry={
          error?.kind === 'write_unconfirmed'
            ? undefined
            : () => {
                setTouched(true);
                if (draft.title.trim()) void doSubmit();
              }
        }
        retryLabel="Submit again"
      />
      <div className="field">
        <label htmlFor="new-request-title">Title</label>
        <input
          id="new-request-title"
          ref={titleRef}
          type="text"
          value={draft.title}
          maxLength={256}
          onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
          aria-invalid={touched && titleMissing}
          aria-describedby={touched && titleMissing ? 'new-request-title-error' : undefined}
        />
        {touched && titleMissing ? (
          <p className="hint" id="new-request-title-error">
            A title is required.
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="new-request-body">Description</label>
        <textarea
          id="new-request-body"
          value={draft.body}
          onFocus={focusBody}
          onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
        />
        <p className="hint">Describe the desired behavior, the observed bug, or any relevant context.</p>
      </div>
      <div className="row">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}