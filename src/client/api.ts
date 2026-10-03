/**
 * Same-origin API client.
 *
 * Error kinds come from the backend unchanged so the UI can show honest recovery
 * states (not authenticated, lost access, rate limited, write unconfirmed, ...)
 * instead of a generic failure.
 */
export interface ApiErrorBody {
  kind: string;
  message: string;
  loginCommand?: string;
  githubUrl?: string;
}

export class ApiError extends Error {
  kind: string;
  loginCommand?: string;
  githubUrl?: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = body.kind;
    this.loginCommand = body.loginCommand;
    this.githubUrl = body.githubUrl;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        'X-Requested-With': 'yolo-blank-canvas',
      },
      ...init,
    });
  } catch {
    throw new ApiError(0, { kind: 'app_unreachable', message: 'The local app is not responding. Is it still running?' });
  }
  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    const body =
      (payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: ApiErrorBody }).error
        : undefined) ?? { kind: 'server_error', message: 'The local app returned an error.' };
    throw new ApiError(response.status, body);
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface SessionInfo {
  authenticated: boolean;
  identity?: string;
  repo?: string;
  loginCommand?: string;
}

export interface IssueSummary {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  state_reason?: string | null;
  html_url?: string;
  labels?: Array<{ name?: string } | string>;
  user?: { login?: string } | null;
  created_at?: string;
  updated_at?: string;
  comments?: number;
}

export interface Comment {
  id: number;
  body?: string | null;
  html_url?: string;
  user?: { login?: string } | null;
  created_at?: string;
  updated_at?: string;
}

export const api = {
  version: () => request<{ name: string; serverBuild: string; clientBuild: string }>('/api/version'),

  session: () => request<SessionInfo>('/api/session'),

  connect: () => request<SessionInfo>('/api/session', { method: 'POST' }),

  retryConnection: () => request<SessionInfo>('/api/session/retry', { method: 'POST' }),

  disconnect: () => request<{ authenticated: boolean }>('/api/session/disconnect', { method: 'POST' }),

  listIssues: (state: 'open' | 'closed' | 'all', page = 1, perPage = 30) =>
    request<{ items: IssueSummary[]; page: number; perPage: number; hasMore: boolean }>(
      `/api/issues?state=${state}&page=${page}&per_page=${perPage}`,
    ),

  getIssue: (number: number) => request<{ issue: IssueSummary }>(`/api/issues/${number}`),

  createIssue: (title: string, body: string) =>
    request<{ issue: IssueSummary }>('/api/issues', { method: 'POST', body: JSON.stringify({ title, body }) }),

  listComments: (number: number, page = 1, perPage = 30) =>
    request<{ items: Comment[]; page: number; perPage: number; hasMore: boolean }>(
      `/api/issues/${number}/comments?page=${page}&per_page=${perPage}`,
    ),

  createComment: (number: number, body: string) =>
    request<{ comment: Comment }>(`/api/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};