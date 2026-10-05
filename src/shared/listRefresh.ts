/**
 * What a list read should do to the rows already on screen.
 *
 * The list is re-read on a timer, on manual refresh, while a just-created
 * request is still unconfirmed, and whenever the Open/Closed/All filter
 * changes. Those are not the same action: only a *different query* makes the
 * rows currently shown wrong. A background refresh is the same query returning
 * newer records, so the rows it already has stay visible until the response
 * lands — otherwise every poll blanks the list and drops the reader's scroll
 * position.
 */
export type ListReadTrigger = 'filter' | 'refresh' | 'retry' | 'manual' | 'more';

export interface ListReadPlan {
  trigger: ListReadTrigger;
  page: number;
  mode: 'replace' | 'append';
  /** Keep the rows already shown while the response is in flight. */
  keepPreviousRows: boolean;
  /** Return to the first page of the query. */
  resetPagination: boolean;
}

export function planListRead(trigger: ListReadTrigger, currentPage: number): ListReadPlan {
  if (trigger === 'more') {
    return {
      trigger,
      page: Math.max(currentPage, 1) + 1,
      mode: 'append',
      keepPreviousRows: true,
      resetPagination: false,
    };
  }
  return {
    trigger,
    page: 1,
    mode: 'replace',
    // A new filter is a different query, so the old rows are not an answer to it.
    keepPreviousRows: trigger !== 'filter',
    resetPagination: true,
  };
}