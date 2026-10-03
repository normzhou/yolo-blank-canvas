/**
 * Launcher: prerequisites, GitHub CLI authentication, port choice, browser open.
 *
 * The GitHub CLI owns credentials. This module only checks that `gh` exists, that
 * it can report an effective account, and that the account can see the target
 * repository. It never reads, copies, or logs a token.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { ghBinary, GH_HOST, effectiveIdentity, checkRepoAccess, GhError } from './gh.js';

export const LOGIN_COMMAND = `gh auth login --hostname ${GH_HOST} --web --skip-ssh-key`;

export function ghVersion({ runner = runProcess } = {}) {
  return runner([ghBinary(), '--version']);
}

function runProcess(args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(args[0], args.slice(1), { timeout: timeoutMs, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function requireGh({ runner = runProcess } = {}) {
  try {
    await runner([ghBinary(), '--version'], { timeoutMs: 10_000 });
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new GhError(
        'GitHub CLI (gh) is required but was not found on PATH.\n' +
          '  Install it, then rerun the same launch command:\n' +
          '    macOS:        brew install gh\n' +
          '    Debian/Ubuntu: sudo apt install gh   (or see https://cli.github.com/)\n' +
          '    Windows:      winget install --id GitHub.cli\n' +
          '    Other:        https://cli.github.com/',
        'gh_missing',
        503,
      );
    }
    throw new GhError('GitHub CLI (gh) could not be run.', 'gh_failed', 503);
  }
}

/** Run the CLI browser login with the user's terminal attached. */
export function runInteractiveLogin({ binary, host = GH_HOST } = {}) {
  return new Promise((resolve) => {
    const child = spawn(binary || ghBinary(), ['auth', 'login', '--hostname', host, '--web', '--skip-ssh-key'], {
      stdio: 'inherit',
    });
    child.on('error', () => resolve({ ok: false, reason: 'missing' }));
    child.on('close', (code) => resolve({ ok: code === 0, code }));
  });
}

/**
 * Return the effective `gh` account, running the browser login once if needed.
 * Network errors never trigger a login loop, and noninteractive runs print the
 * exact command instead of hanging.
 */
export async function connectWithCli({
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  login = runInteractiveLogin,
  identity = effectiveIdentity,
  log = console.log,
} = {}) {
  try {
    return await identity();
  } catch (error) {
    if (error instanceof GhError && error.kind !== 'auth_required') throw error;
    if (!interactive) {
      log(`Not authenticated with GitHub CLI. Run this in your terminal, then rerun the launch command:\n  ${LOGIN_COMMAND}`);
      return null;
    }
    log("Opening GitHub's browser authorization for GitHub CLI...");
    const result = await login();
    if (!result.ok) {
      log(`GitHub login did not complete. To try again:\n  ${LOGIN_COMMAND}\nthen rerun this launch command.`);
      return null;
    }
    try {
      return await identity();
    } catch (retryError) {
      log(retryError?.message || 'GitHub CLI authentication did not complete.');
      return null;
    }
  }
}

/** Confirm the configured repository is visible to the authenticated account. */
export async function confirmRepoAccess(target, { identity = checkRepoAccess } = {}) {
  try {
    return await identity(target);
  } catch (error) {
    if (error instanceof GhError && error.kind === 'not_found') {
      throw new GhError(
        `${target.slug} was not found for the authenticated account. Check the repository name, ` +
          'and that the account can see it.',
        'not_found',
        404,
      );
    }
    if (error instanceof GhError && error.kind === 'forbidden') {
      throw new GhError(
        `The authenticated account cannot access ${target.slug}. Grant access or choose another repository with --repo owner/name.`,
        'forbidden',
        403,
      );
    }
    throw error;
  }
}

export function canListen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

/** Preferred port first, then the next available loopback ports. */
export async function findPort(preferred = 4317, { host = '127.0.0.1', attempts = 20, check = canListen } = {}) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = preferred + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await check(candidate, host)) return candidate;
  }
  throw new Error(`No available port found near ${preferred}.`);
}

export function openBrowser(url, { runner = runProcess, platform = process.platform } = {}) {
  const command =
    platform === 'darwin' ? ['open', url] : platform === 'win32' ? ['cmd', '/c', 'start', '', url] : ['xdg-open', url];
  runner(command, { timeoutMs: 10_000 }).catch(() => {});
}