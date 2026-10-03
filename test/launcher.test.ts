import { describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import { connectWithCli, findPort, requireGh, confirmRepoAccess, LOGIN_COMMAND } from '../server/launch.js';
import { GhError } from '../server/gh.js';

function authRequired() {
  return new GhError('GitHub CLI is not authenticated.', 'auth_required', 401);
}

describe('prerequisites', () => {
  it('explains how to install GitHub CLI when it is missing', async () => {
    const runner = vi.fn(async () => {
      const error = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
      throw error;
    });
    await expect(requireGh({ runner: runner as never })).rejects.toThrowError(/not found on PATH/);
    await expect(requireGh({ runner: runner as never })).rejects.toThrowError(/cli\.github\.com/);
  });

  it('passes when GitHub CLI runs', async () => {
    const runner = vi.fn(async () => ({ stdout: 'gh version 2.50.0', stderr: '' }));
    await expect(requireGh({ runner: runner as never })).resolves.toBe(true);
  });
});

describe('connectWithCli', () => {
  it('reuses an existing login without any extra step', async () => {
    const login = vi.fn(async () => ({ ok: true }));
    const identity = vi.fn(async () => ({ login: 'normzhou' }));
    const result = await connectWithCli({ login: login as never, identity: identity as never, interactive: true });
    expect(result).toEqual({ login: 'normzhou' });
    expect(login).not.toHaveBeenCalled();
  });

  it('runs the CLI browser flow once for a first login, then continues', async () => {
    const login = vi.fn(async () => ({ ok: true }));
    const identity = vi
      .fn()
      .mockRejectedValueOnce(authRequired())
      .mockResolvedValue({ login: 'newuser' });
    const log = vi.fn();
    const result = await connectWithCli({ login: login as never, identity: identity as never, interactive: true, log });
    expect(login).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ login: 'newuser' });
    expect(log).toHaveBeenCalled();
  });

  it('returns a clear retry instruction when login is cancelled', async () => {
    const identity = vi.fn(async () => {
      throw authRequired();
    });
    const log = vi.fn();
    const result = await connectWithCli({
      login: (async () => ({ ok: false, code: 1 })) as never,
      identity: identity as never,
      interactive: true,
      log,
    });
    expect(result).toBeNull();
    expect(log.mock.calls.flat().join('\n')).toContain(LOGIN_COMMAND);
  });

  it('prints the exact command instead of hanging in a noninteractive launch', async () => {
    const login = vi.fn(async () => ({ ok: true }));
    const log = vi.fn();
    const result = await connectWithCli({
      login: login as never,
      identity: (async () => {
        throw authRequired();
      }) as never,
      interactive: false,
      log,
    });
    expect(result).toBeNull();
    expect(login).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join('\n')).toContain('gh auth login --hostname github.com --web --skip-ssh-key');
  });

  it('does not loop into login for network errors', async () => {
    const login = vi.fn(async () => ({ ok: true }));
    await expect(
      connectWithCli({
        login: login as never,
        identity: (async () => {
          throw new GhError('GitHub is unreachable from this machine.', 'github_unavailable', 503);
        }) as never,
        interactive: true,
      }),
    ).rejects.toThrowError(/unreachable/);
    expect(login).not.toHaveBeenCalled();
  });
});

describe('repository access guidance', () => {
  const target = { owner: 'normzhou', name: 'yolo-blank-canvas', slug: 'normzhou/yolo-blank-canvas' };

  it('names the repository when it cannot be found', async () => {
    const identity = vi.fn(async () => {
      throw new GhError('not found', 'not_found', 404);
    });
    await expect(confirmRepoAccess(target, { identity: identity as never })).rejects.toThrowError(
      /normzhou\/yolo-blank-canvas was not found/,
    );
  });

  it('suggests --repo when access is missing', async () => {
    const identity = vi.fn(async () => {
      throw new GhError('forbidden', 'forbidden', 403);
    });
    await expect(confirmRepoAccess(target, { identity: identity as never })).rejects.toThrowError(/--repo owner\/name/);
  });
});

describe('port selection', () => {
  it('uses the preferred port when it is free', async () => {
    await expect(findPort(4317, { check: async () => true })).resolves.toBe(4317);
  });

  it('falls back to the next available loopback port', async () => {
    const check = vi.fn(async (port: number) => port !== 4317 && port !== 4318);
    await expect(findPort(4317, { check })).resolves.toBe(4319);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('really binds loopback', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as net.AddressInfo).port;
    const { canListen } = await import('../server/launch.js');
    await expect(canListen(port)).resolves.toBe(false);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});