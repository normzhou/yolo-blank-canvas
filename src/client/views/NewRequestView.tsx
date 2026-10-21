import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary } from '../api';
import { ErrorNotice } from '../components/ErrorNotice';
import {
  NOTES_FIELD,
  REQUEST_INTENTS,
  renderRequestBody,
  requestTemplate,
  type NewRequestDraft,
  type RequestField,
} from '../requestTemplates';

/**
 * Captures one ordinary request. The guided form only shapes the body; it adds
 * no labels, priority, assignee, or second record. "Write freely instead" hands
 * the generated body to the ordinary editor so the escape hatch is never a dead
 * end.
 */
export function NewRequestView({
  draft,
  onDraftChange,
  onCancel,
  onCreated,
  build = '',
}: {
  draft: NewRequestDraft;
  onDraftChange: (next: NewRequestDraft) => void;
  onCancel: () => void;
  onCreated: (issue: IssueSummary) => void;
  build?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [touched, setTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const submittingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const bodyCaretPlaced = useRef(false);
  const freeformRequested = useRef(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (draft.mode === 'freeform' && freeformRequested.current) {
      freeformRequested.current = false;
      bodyRef.current?.focus();
    }
  }, [draft.mode]);

  /**
   * #169: the freeform body can open with a visible app-context line (or a
   * restored draft). Tabbing into it must not select the whole value and let the
   * first keystroke replace it; put the caret after the existing text on first
   * focus. A deliberate click inside the text keeps its position.
   */
  function focusBody(event: React.FocusEvent<HTMLTextAreaElement>) {
    if (bodyCaretPlaced.current) return;
    bodyCaretPlaced.current = true;
    const body = event.currentTarget;
    if (body.value.length > 0 && body.selectionStart === 0) {
      body.setSelectionRange(body.value.length, body.value.length);
    }
  }

  const template = requestTemplate(draft.intent);
  const titleMissing = draft.title.trim().length === 0;
  const primaryMissing = draft.mode === 'guided' && draft.details.trim().length === 0;
  const generatedBody = draft.mode === 'guided' ? renderRequestBody(draft, { build }) : draft.body;
  const canSubmit =
    !titleMissing && (draft.mode === 'freeform' || draft.details.trim().length > 0);

  function setField(key: RequestField, value: string) {
    onDraftChange({ ...draft, fields: { ...draft.fields, [key]: value } });
  }

  function switchIntent(intent: NewRequestDraft['intent']) {
    onDraftChange({ ...draft, intent });
  }

  function writeFreely() {
    onDraftChange({ ...draft, mode: 'freeform', body: generatedBody });
    freeformRequested.current = true;
  }

  function useGuidedForm() {
    const context = draft.context.trim();
    let trimmedBody = draft.body.trim();
    if (context && trimmedBody.startsWith(context)) {
      trimmedBody = trimmedBody.slice(context.length).trim();
    }
    const nextDetails = draft.details.trim() !== '' ? draft.details : trimmedBody;
    onDraftChange({ ...draft, mode: 'guided', details: nextDetails });
  }

  async function doSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createIssue(draft.title, generatedBody);
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
    if (titleMissing) {
      titleRef.current?.focus();
      return;
    }
    if (primaryMissing) {
      detailsRef.current?.focus();
      return;
    }
    // A double click must not create two issues.
    void doSubmit();
  }

  function retry() {
    setTouched(true);
    if (canSubmit) void doSubmit();
  }

  const contextLine = draft.context.split('\n')[0]?.trim() ?? '';
  const showContext = draft.context.trim().length > 0 || contextOpen;
  const buildLabel = build.trim() && build.trim() !== 'unknown' ? build.trim().slice(0, 7) : '';

  return (
    <form onSubmit={submit} noValidate>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>New request</h2>
      <ErrorNotice
        error={error}
        onRetry={error?.kind === 'write_unconfirmed' ? undefined : retry}
        retryLabel="Submit again"
      />

      {draft.mode === 'guided' && showContext ? (
        <div className="request-context">
          <div className="request-context-summary">
            <span className="request-context-label">Context</span>
            <code>{contextLine || 'No app context'}</code>
            {buildLabel ? <span className="request-context-build">build {buildLabel}</span> : null}
            <button
              type="button"
              className="link-button"
              aria-label="Edit context"
              aria-expanded={contextOpen}
              aria-controls="new-request-context"
              onClick={() => setContextOpen((open) => !open)}
            >
              {contextOpen ? 'Done' : 'Edit'}
            </button>
          </div>
          {contextOpen ? (
            <div className="field request-context-field">
              <label htmlFor="new-request-context">Context line</label>
              <textarea
                id="new-request-context"
                className="compact-field"
                rows={2}
                value={draft.context}
                onChange={(event) => onDraftChange({ ...draft, context: event.target.value })}
              />
              <p className="hint">Posted first in the issue body so the request keeps its app context.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {draft.mode === 'guided' ? (
        <fieldset className="intent-fieldset">
          <legend>What kind of request?</legend>
          <div className="intent-grid">
            {REQUEST_INTENTS.map((intent) => {
              const option = requestTemplate(intent);
              const selected = draft.intent === intent;
              return (
                <label key={intent} className={selected ? 'intent-card is-selected' : 'intent-card'}>
                  <input
                    type="radio"
                    name="request-intent"
                    value={intent}
                    checked={selected}
                    onChange={() => switchIntent(intent)}
                  />
                  <span className="intent-card-content">
                    <span className="intent-card-title">{option.label}</span>
                    <span className="intent-card-hint">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

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
          <p className="hint error-hint" id="new-request-title-error">
            A title is required.
          </p>
        ) : null}
      </div>

      {draft.mode === 'guided' ? (
        <>
          <div className="field">
            <label htmlFor="new-request-details">{template.primaryLabel}</label>
            <textarea
              id="new-request-details"
              ref={detailsRef}
              value={draft.details}
              onChange={(event) => onDraftChange({ ...draft, details: event.target.value })}
              aria-invalid={touched && primaryMissing}
              aria-describedby={
                touched && primaryMissing ? 'new-request-details-error new-request-details-hint' : 'new-request-details-hint'
              }
            />
            <p className="hint" id="new-request-details-hint">
              {template.primaryHint}
            </p>
            {touched && primaryMissing ? (
              <p className="hint error-hint" id="new-request-details-error">
                An answer is required.
              </p>
            ) : null}
          </div>

          {template.secondary ? (
            <div className="field">
              <label htmlFor={`new-request-${template.secondary.key}`}>{template.secondary.label}</label>
              <textarea
                id={`new-request-${template.secondary.key}`}
                className="compact-field"
                rows={2}
                value={draft.fields[template.secondary.key]}
                onChange={(event) => setField(template.secondary!.key, event.target.value)}
              />
              <p className="hint">{template.secondary.hint}</p>
            </div>
          ) : null}

          <button
            type="button"
            className="disclosure"
            aria-expanded={moreOpen}
            aria-controls="new-request-more"
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? 'Fewer details' : 'More details'}
          </button>
          {moreOpen ? (
            <div id="new-request-more" className="more-details">
              {template.more.map((field) => (
                <div className="field" key={field.key}>
                  <label htmlFor={`new-request-${field.key}`}>{field.label}</label>
                  <textarea
                    id={`new-request-${field.key}`}
                    className="compact-field"
                    rows={2}
                    value={draft.fields[field.key]}
                    onChange={(event) => setField(field.key, event.target.value)}
                  />
                  <p className="hint">{field.hint}</p>
                </div>
              ))}
              <div className="field">
                <label htmlFor={`new-request-${NOTES_FIELD.key}`}>{NOTES_FIELD.label}</label>
                <textarea
                  id={`new-request-${NOTES_FIELD.key}`}
                  className="compact-field"
                  rows={2}
                  value={draft.fields.notes}
                  onChange={(event) => setField(NOTES_FIELD.key, event.target.value)}
                />
                <p className="hint">{NOTES_FIELD.hint}</p>
              </div>
            </div>
          ) : null}

          <details className="request-preview">
            <summary>Preview issue body</summary>
            <pre aria-label="Generated issue body">{generatedBody}</pre>
          </details>

          <p className="hint request-public-note">
            This creates a public GitHub issue. Don&apos;t include secrets or private logs.
          </p>

          <div className="row request-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="link-button" onClick={writeFreely} disabled={submitting}>
              Write freely instead
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="new-request-body">Description</label>
            <textarea
              id="new-request-body"
              ref={bodyRef}
              value={draft.body}
              onFocus={focusBody}
              onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
            />
            <p className="hint">The generated body is here; edit anything before submitting.</p>
          </div>
          <div className="row request-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="link-button" onClick={useGuidedForm} disabled={submitting}>
              Use guided form
            </button>
          </div>
        </>
      )}
    </form>
  );
}
