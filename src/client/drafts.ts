/**
 * Draft persistence.
 *
 * Opening/closing the panel, refreshing records, a failed sign-in, or a
 * user-initiated reload must never destroy typed input. Drafts live in
 * sessionStorage (this tab only) and are only cleared after a confirmed write.
 */
export interface NewRequestDraft {
  title: string;
  body: string;
}

export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const NEW_REQUEST_KEY = 'yolo.draft.new-request';
export const REPLY_KEY_PREFIX = 'yolo.draft.reply.';

export function loadDraft(store: DraftStore | null | undefined, key: string): NewRequestDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NewRequestDraft>;
    if (typeof parsed?.title !== 'string' || typeof parsed?.body !== 'string') return null;
    return { title: parsed.title, body: parsed.body };
  } catch {
    return null;
  }
}

export function saveDraft(store: DraftStore, key: string, draft: NewRequestDraft): void {
  try {
    store.setItem(key, JSON.stringify(draft));
  } catch {
    // A full or unavailable storage must not break typing.
  }
}

export function clearDraft(store: DraftStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // Ignore: the in-memory draft is still cleared by the caller.
  }
}

export function replyKey(issueNumber: number): string {
  return `${REPLY_KEY_PREFIX}${issueNumber}`;
}

export function browserStore(): DraftStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}