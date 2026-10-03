/**
 * All GitHub access goes through the GitHub CLI.
 *
 * - No token is read, copied, logged, or forwarded: `gh` owns credential storage.
 * - Requests are fixed-host, repository-scoped argument arrays executed without a
 *   shell, so user text stays JSON data and can never become a command or flag.
 */
import { execFile } from 'node:child_process';

/** Read lazily so tests (and future overrides) can point at a different binary. */
export function ghBinary() {
  return process.env.YOLO_GH_BIN || 'gh';
}
export const GH_HOST = 'github.com';

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Thrown for programmer/user input that must never reach `gh`. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/** A single configured target: `owner/repo`, validated once at launch. */
export function parseTarget(repo) {
  if (typeof repo !== 'string') throw new ValidationError('Repository must be owner/name.');
  const trimmed = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const parts = trimmed.split('/');
  if (parts.length !== 2) throw new ValidationError(`Invalid repository "${repo}". Expected owner/name.`);
  const [owner, name] = parts;
  if (!OWNER_RE.test(owner)) throw new ValidationError(`Invalid repository owner "${owner}".`);
  // A leading dash could turn the value into a `gh` flag, so it is never allowed.
  if (!REPO_RE.test(name) || name === '.' || name === '..' || name.startsWith('-')) {
    throw new ValidationError(`Invalid repository name "${name}".`);
  }
  return { owner, name, slug: `${owner}/${name}` };
}

export function validateIssueNumber(value) {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!/^\d{1,10}$/.test(raw)) throw new ValidationError('Invalid issue number.');
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000_000) throw new ValidationError('Invalid issue number.');
  return n;
}

/**
 * Run `gh api` with a validated argument array. JSON bodies are passed on stdin
 * via `--input -`, never interpolated into the argument list or a shell string.
 */
export function runGhApi(args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    // Callers pass only the path and flags; the `api` subcommand is added here so
    // no caller can construct a different gh command.
    const child = execFile(
      ghBinary(),
      ['api', ...args],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(decorate(error, stderr));
          return;
        }
        const text = stdout.trim();
        if (!text) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new GhError('GitHub CLI returned a response that was not JSON.', 'gh_bad_output', 502));
        }
      },
    );
    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}

/** Same as runGhApi but returns raw text (used by `gh auth token`-free identity checks). */
export function runGh(args, { timeoutMs = 60_000, stdio = 'pipe' } = {}) {
  return new Promise((resolve, reject) => {
    execFile(ghBinary(), args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(decorate(error, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
    void stdio;
  });
}

export class GhError extends Error {
  constructor(message, kind, statusCode) {
    super(message);
    this.name = 'GhError';
    this.kind = kind;
    this.statusCode = statusCode ?? 502;
  }
}

/**
 * Translate CLI failures into honest states. The token value never reaches us:
 * `gh` reports auth problems on stderr without printing credentials, and we only
 * keep the exit code plus a short, non-sensitive status line.
 */
function decorate(error, stderr) {
  // Classify on the short status line only: full help output is noisy and mentions
  // words like "access" that would otherwise produce a misleading state.
  const message = String(stderr || error?.message || '').slice(0, 500);
  const lower = message.toLowerCase();
  if (error?.code === 'ENOENT') {
    return new GhError('GitHub CLI (gh) is not installed or not on PATH.', 'gh_missing', 503);
  }
  if (/not logged into|authentication required|gh auth login|no such host/i.test(lower)) {
    return new GhError('GitHub CLI is not authenticated. Run `gh auth login --hostname github.com --web --skip-ssh-key`.', 'auth_required', 401);
  }
  if (/secondary rate limit|api rate limit|rate limit exceeded/i.test(lower)) {
    return new GhError('GitHub API rate limit reached. Wait and refresh.', 'rate_limited', 429);
  }
  if (/could not resolve|network|dial tcp|connection refused|timeout/i.test(lower)) {
    return new GhError('GitHub is unreachable from this machine.', 'github_unavailable', 503);
  }
  if (/could not find|not found|404/i.test(lower)) {
    return new GhError('Repository or resource not found, or your account cannot see it.', 'not_found', 404);
  }
  if (/403|permission|access/i.test(lower)) {
    return new GhError('Your GitHub account does not have the access this app requires.', 'forbidden', 403);
  }
  if (/gh: command not found/i.test(message)) {
    return new GhError('GitHub CLI (gh) is not installed or not on PATH.', 'gh_missing', 503);
  }
  return new GhError('GitHub CLI request failed.', 'gh_failed', 502);
}

/** `gh api user` in the same environment used for later requests. */
export async function effectiveIdentity({ runner = runGhApi } = {}) {
  const user = await runner(['user']);
  if (!user || typeof user.login !== 'string') {
    throw new GhError('GitHub CLI did not report an authenticated account.', 'auth_required', 401);
  }
  return { login: user.login };
}

/** Confirm the authenticated account can see the configured repository. */
export async function checkRepoAccess(target, { runner = runGhApi } = {}) {
  const repo = await runner([`repos/${target.owner}/${target.name}`]);
  if (!repo || !repo.full_name) {
    throw new GhError(`Repository ${target.slug} is not visible to the authenticated account.`, 'forbidden', 403);
  }
  return { fullName: repo.full_name, hasIssues: repo.has_issues !== false };
}