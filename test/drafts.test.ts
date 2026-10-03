import { describe, expect, it } from 'vitest';
import { NEW_REQUEST_KEY, REPLY_KEY_PREFIX, loadDraft, saveDraft, clearDraft, replyKey, type DraftStore } from '../src/client/drafts';

function memoryStore(): DraftStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** Drafts must survive panel open/close, refreshes, sign-in failures, and reloads. */
describe('draft preservation', () => {
  it('round-trips a new-request draft', () => {
    const store = memoryStore();
    saveDraft(store, NEW_REQUEST_KEY, { title: 'Add dark mode', body: 'both canvas and panel' });
    expect(loadDraft(store, NEW_REQUEST_KEY)).toEqual({ title: 'Add dark mode', body: 'both canvas and panel' });
  });

  it('keeps per-issue reply drafts separate', () => {
    const store = memoryStore();
    saveDraft(store, replyKey(12), { title: '', body: 'reply for 12' });
    saveDraft(store, replyKey(11), { title: '', body: 'reply for 11' });
    expect(loadDraft(store, replyKey(12))?.body).toBe('reply for 12');
    expect(loadDraft(store, replyKey(11))?.body).toBe('reply for 11');
    expect(replyKey(12)).toBe(`${REPLY_KEY_PREFIX}12`);
  });

  it('only drops a draft when it is cleared after a confirmed write', () => {
    const store = memoryStore();
    saveDraft(store, NEW_REQUEST_KEY, { title: 'x', body: 'y' });
    expect(loadDraft(store, NEW_REQUEST_KEY)).not.toBeNull();
    clearDraft(store, NEW_REQUEST_KEY);
    expect(loadDraft(store, NEW_REQUEST_KEY)).toBeNull();
  });

  it('ignores corrupt or foreign values instead of crashing', () => {
    const store = memoryStore();
    store.setItem(NEW_REQUEST_KEY, 'not json');
    expect(loadDraft(store, NEW_REQUEST_KEY)).toBeNull();
    store.setItem(NEW_REQUEST_KEY, '{"title":1}');
    expect(loadDraft(store, NEW_REQUEST_KEY)).toBeNull();
    expect(loadDraft(null, NEW_REQUEST_KEY)).toBeNull();
  });

  it('tolerates storage that refuses to write', () => {
    const failing: DraftStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('nope');
      },
    };
    expect(() => saveDraft(failing, NEW_REQUEST_KEY, { title: 'a', body: 'b' })).not.toThrow();
    expect(() => clearDraft(failing, NEW_REQUEST_KEY)).not.toThrow();
  });
});