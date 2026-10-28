import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, arch } from 'node:os';
import { execFile } from 'node:child_process';
import { explicitActivity } from './observer-core.mjs';

// The binding wraps this definition with the harness-provided Plugin.define.
export default {
  id: 'yolo.activity-observer',
  async setup(ctx) {
    if (!String(ctx.app.version).startsWith('2.')) return;
    const root = ctx.location.directory;
    let binary;
    try {
      const manifest = JSON.parse(readFileSync(join(root, '.agents/skills/yolo/references/provenance.json'), 'utf8'));
      if (!manifest.activity_observers?.includes('opencode-v2-events-v1')) return;
      const key = manifest.output.sha256;
      if (!/^[a-f0-9]{64}$/.test(key)) return;
      const base = process.env.YOLO_OBSERVE_CONFIG_DIR ?? (platform() === 'darwin' ? join(homedir(), 'Library/Application Support/yolo') : platform() === 'win32' ? join(process.env.APPDATA ?? '', 'yolo') : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'yolo'));
      binary = join(base, 'checkers/bundles', key, platform() + '_' + (arch() === 'x64' ? 'amd64' : arch()), 'yolo-check' + (platform() === 'win32' ? '.exe' : ''));
    } catch { return; }
    const sessions = new Set();
    let chain = Promise.resolve(), pending = 0;
    const send = event => {
      if (pending >= 16) return Promise.resolve();
      pending++;
      chain = chain.then(() => new Promise(resolve => {
        const child = execFile(binary, ['observe', 'hook', 'opencode', root, String(ctx.app.version)], { timeout: 5000, maxBuffer: 1024 }, () => resolve());
        child.stdin?.on('error', () => {});
        child.stdin?.end(JSON.stringify(event));
      })).catch(() => {}).finally(() => pending--);
      return chain;
    };
    const registration = await ctx.session.hook('prompt', async event => {
      const id = event.sessionID;
      if (typeof id !== 'string') return;
      let text = event.prompt.text ?? '';
      const prefix = 'Read `.agents/skills/yolo/SKILL.md` from the repository root and follow the requested activity.\nUser request: ';
      if (text.startsWith(prefix)) text = '$yolo ' + text.slice(prefix.length).trim();
      const match = explicitActivity(text);
      if (!match && !sessions.has(id)) return;
      if (sessions.size >= 64 && !sessions.has(id)) return;
      sessions.add(id);
      // Only the recognized enum and dry-run bit leave the plugin process.
      await send({ hook_event_name: 'prompt', session_id: id, prompt: match ? '$yolo ' + match.activity + (match.dry ? ' --dry-run' : '') : '' });
    });
    const controller = new AbortController();
    const stream = (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        const id = event.data?.sessionID;
        if (sessions.has(id) && ['session.execution.succeeded', 'session.execution.failed'].includes(event.type)) {
          await send({ hook_event_name: event.type, session_id: id });
          sessions.delete(id);
        }
      }
    })().catch(() => {});
    return async () => { controller.abort(); await registration.dispose(); await stream; await chain; };
  },
};
