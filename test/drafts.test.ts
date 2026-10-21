import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_KEY_PREFIX,
  NEW_REQUEST_KEY,
  REPLY_KEY_PREFIX,
  loadDraft,
  loadNewRequestDraft,
  saveDraft,
  clearDraft,
  feedbackKey,
  replyKey,
  type DraftStore,
} from '../src/client/drafts';
import { createNewRequestDraft } from '../src/client/requestTemplates';

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
  it('round-trips a two-field text draft', () => {
    const store = memoryStore();
    saveDraft(store, NEW_REQUEST_KEY, { title: 'Add dark mode', body: 'both canvas and panel' });
    expect(loadDraft(store, NEW_REQUEST_KEY)).toEqual({ title: 'Add dark mode', body: 'both canvas and panel' });
  });

  it('round-trips a v2 guided new-request draft with all fields intact', () => {
    const store = memoryStore();
    const fallback = createNewRequestDraft({ intent: 'change' });
    const draft = {
      ...createNewRequestDraft({ intent: 'problem', context: 'App: Tetris (?app=tetris)' }),
      title: 'Piece clips wall',
      details: 'Left arrow near the wall overlaps the border.',
      fields: {
        impact: '',
        approach: '',
        reproduction: 'Hold left while rotating I-piece',
        expected: 'Wall kick keeps the piece in bounds',
        notes: 'Observed in Dusk theme',
      },
    };
    saveDraft(store, feedbackKey('tetris'), draft);
    expect(loadNewRequestDraft(store, feedbackKey('tetris'), fallback)).toEqual(draft);
  });

  it('migrates a v1 {title, body} draft into freeform mode without data loss', () => {
    const store = memoryStore();
    store.setItem(
      feedbackKey('tetris'),
      JSON.stringify({
        title: 'Legacy feedback draft',
        body: 'App: Tetris (?app=tetris)\n\nWritten before v2 existed.',
      }),
    );
    const fallback = createNewRequestDraft({
      intent: 'feedback',
      context: 'App: Tetris (?app=tetris)',
    });
    const migrated = loadNewRequestDraft(store, feedbackKey('tetris'), fallback);
    expect(migrated).toEqual({
      version: 2,
      mode: 'freeform',
      intent: 'feedback',
      title: 'Legacy feedback draft',
      details: '',
      fields: { impact: '', approach: '', reproduction: '', expected: '', notes: '' },
      context: 'App: Tetris (?app=tetris)',
      body: 'App: Tetris (?app=tetris)\n\nWritten before v2 existed.',
    });
  });

  it('keeps per-issue reply drafts separate', () => {
    const store = memoryStore();
    saveDraft(store, replyKey(12), { title: '', body: 'reply for 12' });
    saveDraft(store, replyKey(11), { title: '', body: 'reply for 11' });
    expect(loadDraft(store, replyKey(12))?.body).toBe('reply for 12');
    expect(loadDraft(store, replyKey(11))?.body).toBe('reply for 11');
    expect(replyKey(12)).toBe(`${REPLY_KEY_PREFIX}12`);
  });

  it('keeps app feedback drafts separate from each other and the home draft', () => {
    const store = memoryStore();
    const homeFallback = createNewRequestDraft({ intent: 'change' });
    const tetrisFallback = createNewRequestDraft({ intent: 'feedback', context: 'App: Tetris (?app=tetris)' });
    const otherFallback = createNewRequestDraft({ intent: 'feedback', context: 'App: Other (?app=other)' });

    saveDraft(store, NEW_REQUEST_KEY, { ...homeFallback, title: 'home', details: 'home details' });
    saveDraft(store, feedbackKey('tetris'), { ...tetrisFallback, title: 'tetris', details: 'tetris details' });
    saveDraft(store, feedbackKey('other'), { ...otherFallback, title: 'other', details: 'other details' });

    expect(feedbackKey('tetris')).toBe(`${FEEDBACK_KEY_PREFIX}tetris`);
    expect(feedbackKey('tetris')).not.toBe(NEW_REQUEST_KEY);
    expect(loadNewRequestDraft(store, NEW_REQUEST_KEY, homeFallback)?.title).toBe('home');
    expect(loadNewRequestDraft(store, feedbackKey('tetris'), tetrisFallback)?.title).toBe('tetris');
    expect(loadNewRequestDraft(store, feedbackKey('other'), otherFallback)?.title).toBe('other');
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
    const fallback = createNewRequestDraft({ intent: 'change' });
    store.setItem(NEW_REQUEST_KEY, 'not json');
    expect(loadDraft(store, NEW_REQUEST_KEY)).toBeNull();
    expect(loadNewRequestDraft(store, NEW_REQUEST_KEY, fallback)).toBeNull();

    store.setItem(NEW_REQUEST_KEY, '{"title":1}');
    expect(loadDraft(store, NEW_REQUEST_KEY)).toBeNull();
    expect(loadNewRequestDraft(store, NEW_REQUEST_KEY, fallback)).toBeNull();

    store.setItem(NEW_REQUEST_KEY, '{"version":2,"intent":"invalid","title":"ok","details":"ok"}');
    expect(loadNewRequestDraft(store, NEW_REQUEST_KEY, fallback)).toBeNull();

    expect(loadDraft(null, NEW_REQUEST_KEY)).toBeNull();
    expect(loadNewRequestDraft(null, NEW_REQUEST_KEY, fallback)).toBeNull();
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
