import type { DerivedStatus } from '../../shared/status';

/** Status is text first; colour is decoration. */
export function StatusBadge({ status }: { status: DerivedStatus }) {
  return (
    <span className={`badge ${status.tone}`} title={status.rawLabels.length ? status.rawLabels.join(', ') : undefined}>
      {status.label}
    </span>
  );
}

export function StatusDetail({ status }: { status: DerivedStatus }) {
  return (
    <>
      <StatusBadge status={status} />
      {status.note ? <p className="note">{status.note}</p> : null}
      {status.needsReconciliation && status.rawLabels.length ? (
        <p className="note">
          Raw labels: <span className="label-chip">{status.rawLabels.join(' ')}</span>
        </p>
      ) : null}
    </>
  );
}