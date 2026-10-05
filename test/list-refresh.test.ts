import { describe, expect, it } from 'vitest';
import { planListRead } from '../src/shared/listRefresh';

/**
 * A background refresh is the same query returning newer records, so the rows
 * already on screen must survive it. Only a different query (the Open/Closed/All
 * filter) may clear the list immediately. Pinning this keeps the list from
 * blanking on every poll and losing the reader's scroll position.
 */
describe('list refresh planning', () => {
  it('keeps the current rows during a background refresh', () => {
    const plan = planListRead('refresh', 3);
    expect(plan).toEqual({ trigger: 'refresh', page: 1, mode: 'replace', keepPreviousRows: true, resetPagination: true });
  });

  it('keeps the current rows for a manual refresh and for reconciliation retries', () => {
    for (const trigger of ['manual', 'retry'] as const) {
      const plan = planListRead(trigger, 1);
      expect(plan.keepPreviousRows).toBe(true);
      expect(plan.mode).toBe('replace');
      expect(plan.page).toBe(1);
      expect(plan.resetPagination).toBe(true);
    }
  });

  it('clears immediately when the filter changes, because it is a different query', () => {
    const plan = planListRead('filter', 2);
    expect(plan.keepPreviousRows).toBe(false);
    expect(plan.mode).toBe('replace');
    expect(plan.page).toBe(1);
    expect(plan.resetPagination).toBe(true);
  });

  it('appends the next page without disturbing what is already shown', () => {
    expect(planListRead('more', 2)).toEqual({
      trigger: 'more',
      page: 3,
      mode: 'append',
      keepPreviousRows: true,
      resetPagination: false,
    });
  });

  it('never asks for a page below one when appending', () => {
    expect(planListRead('more', 0).page).toBe(2);
    expect(planListRead('more', -3).page).toBe(2);
  });
});