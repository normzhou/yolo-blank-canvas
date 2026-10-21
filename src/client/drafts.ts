/**
 * Draft persistence.
 *
 * Opening/closing the panel, refreshing records, a failed sign-in, or a
 * user-initiated reload must never destroy typed input. Drafts live in
 * sessionStorage (this tab only) and are only cleared after a confirmed write.
 */
import {
  createNewRequestDraft,
  emptyRequestFields,
  isRequestIntent,
  type NewRequestDraft,
  type RequestFields,
  type RequestMode,
} from './requestTemplates';

export type { NewRequestDraft } from './requestTemplates';

export interface TextDraft {
  title: string;
  body: string;
}

export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const NEW_REQUEST_KEY = 'yolo.draft.new-request';
export const FEEDBACK_KEY_PREFIX = 'yolo.draft.feedback.';
export const REPLY_KEY_PREFIX = 'yolo.draft.reply.';

/** Replies and other two-field drafts. */
export function loadDraft(store: DraftStore | null | undefined, key: string): TextDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TextDraft>;
    if (typeof parsed?.title !== 'string' || typeof parsed?.body !== 'string') return null;
    return { title: parsed.title, body: parsed.body };
  } catch {
    return null;
  }
}

/**
 * Load a v2 composer draft. A v1 `{title, body}` draft is preserved verbatim as
 * freeform rather than trying to guess which guided field its text belongs in.
 */
export function loadNewRequestDraft(
  store: DraftStore | null | undefined,
  key: string,
  fallback: NewRequestDraft,
): NewRequestDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.version === 2) return normalizeV2(parsed);

    // v1: the blank composer stored title and body only.
    if (typeof parsed.title === 'string' && typeof parsed.body === 'string') {
      return {
        ...createNewRequestDraft({ intent: fallback.intent, context: fallback.context }),
        mode: 'freeform',
        title: parsed.title,
        body: parsed.body,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeV2(value: Record<string, unknown>): NewRequestDraft | null {
  const mode: RequestMode = value.mode === 'freeform' ? 'freeform' : 'guided';
  if (!isRequestIntent(value.intent)) return null;
  if (typeof value.title !== 'string') return null;
  if (typeof value.details !== 'string') return null;

  const fields = value.fields && typeof value.fields === 'object' ? (value.fields as Record<string, unknown>) : {};
  return {
    version: 2,
    mode,
    intent: value.intent,
    title: value.title,
    details: value.details,
    fields: normalizeFields(fields),
    context: typeof value.context === 'string' ? value.context : '',
    body: typeof value.body === 'string' ? value.body : '',
  };
}

function normalizeFields(value: Record<string, unknown>): RequestFields {
  const fields = emptyRequestFields();
  for (const key of Object.keys(fields) as Array<keyof RequestFields>) {
    if (typeof value[key] === 'string') fields[key] = value[key] as string;
  }
  return fields;
}

export function saveDraft(store: DraftStore, key: string, draft: unknown): void {
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

/**
 * A new-request draft scoped to an app (#169). The home composer keeps
 * NEW_REQUEST_KEY, so app context and generic drafts cannot overwrite each
 * other.
 */
export function feedbackKey(appId: string): string {
  return `${FEEDBACK_KEY_PREFIX}${appId}`;
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
