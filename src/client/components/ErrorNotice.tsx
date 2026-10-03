import type { ApiError } from '../api';

/**
 * Honest failure display: what happened, the exact recovery action, and any
 * GitHub link needed to check an uncertain write. Nothing is claimed as done.
 */
export function ErrorNotice({
  error,
  onRetry,
  retryLabel = 'Retry',
}: {
  error: ApiError | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (!error) return null;
  const needsLogin = error.kind === 'auth_required' || error.kind === 'session_required';
  const unconfirmed = error.kind === 'write_unconfirmed';
  return (
    <div className="error" role="alert">
      <div>{error.message}</div>
      {needsLogin && error.loginCommand ? (
        <div className="hint">
          Run in your terminal: <code>{error.loginCommand}</code>
        </div>
      ) : null}
      {unconfirmed && error.githubUrl ? (
        <div className="hint">
          Check <a href={error.githubUrl} target="_blank" rel="noreferrer noopener">GitHub</a> before submitting again.
        </div>
      ) : null}
      {onRetry ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}