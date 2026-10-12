import { readFileSync, realpathSync, mkdtempSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { NativeObserver, explicitActivity } from './observer-core.mjs';

// Pi supplies the JS runtime; target users need only the published executable.
export default function (pi: any) {
  let observer: any, root = '', binary = '', reportPath = '', temporary = '', setup: Promise<any> | null = null;
  let chain = Promise.resolve(), pending = 0, saved: Record<string, string | undefined> = {};
  let closing = false; const children = new Set<any>(); const copies: string[] = [];
  let notify = (_text: string) => {};
  const run = (args: string[], body?: unknown, timeout = 5500) => new Promise<any>(resolve => {
    const child = execFile(binary, args, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      children.delete(child);
      try { resolve(error ? { status: 'unavailable' } : JSON.parse(stdout)); } catch { resolve({ status: 'unavailable' }); }
    });
    children.add(child);
    child.stdin?.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const status = (ctx: any, text: string) => { if (ctx.hasUI) ctx.ui.setStatus('yolo-observation', 'YOLO observation: ' + text); };
  const resetEnvironment = () => {
    for (const key of ['YOLO_ACTIVITY_ID', 'YOLO_ACTIVITY_REPORT', 'YOLO_ADOPTION_ID']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  };
  const send = (event: unknown, dry: boolean) => {
    if (closing || pending >= 16) return; // Bounded in-memory queue, no transcript/outbox.
    pending++;
    chain = chain.then(async () => {
      if (closing) return;
      if (!dry && !setup) setup = run(['observe', 'setup', root], undefined, 3500);
      if (!dry && (await setup)?.status !== 'ready') {
        notify((await setup)?.status === 'revoked' ? 'revoked' : 'enrollment unavailable');
        setup = null; return;
      }
      const result = await run(['observe', 'emit', '--root', root, ...(dry ? ['--dry-run'] : [])], event);
      if (result.transmission === 'revoked') notify('revoked');
      else if (!dry && result.transmission !== 'sent') notify('transmission unavailable');
    }).catch(() => {}).finally(() => { pending--; });
  };
  const nativeVersion = () => {
    let path = dirname(realpathSync(process.argv[1]));
    for (let i = 0; i < 8; i++, path = dirname(path)) {
      try { const p = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')); if (p.name === '@earendil-works/pi-coding-agent') return p.version; } catch {}
    }
    return 'unknown';
  };
  pi.on('session_start', async (_event: any, ctx: any) => {
    notify = text => { status(ctx, text); if (!ctx.hasUI) process.stderr.write('YOLO observation: ' + text + '\n'); };
    root = ctx.cwd; observer = null; setup = null; closing = false;
    if (!ctx.isProjectTrusted() || nativeVersion() !== '1.1.0') { status(ctx, 'unsupported harness/version'); return; }
    try {
      const adoption = JSON.parse(readFileSync(join(root, '.yolo/adoption.json'), 'utf8'));
      const consent = adoption.observation;
      if (consent?.enabled !== true || !consent.acceptance?.length || adoption.activation?.state !== 'active') { status(ctx, 'off'); return; }
      const manifest = JSON.parse(readFileSync(join(root, '.agents/skills/yolo/references/provenance.json'), 'utf8'));
      if (manifest.activity_observation !== 'pi-native-v1') { status(ctx, 'installed pin needs upgrade'); return; }
      const config = process.env.YOLO_OBSERVE_CONFIG_DIR ?? (platform() === 'darwin' ? join(homedir(), 'Library/Application Support/yolo') : platform() === 'win32' ? join(process.env.AppData ?? '', 'yolo') : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'yolo'));
      const cached = join(config, 'checkers', adoption.harness.skill.revision, platform() + '_' + (arch() === 'x64' ? 'amd64' : arch()));
      binary = join(cached, 'yolo-check' + (platform() === 'win32' ? '.exe' : ''));
      const identity = JSON.parse(readFileSync(join(cached, 'identity.json'), 'utf8'));
      if (identity.publication !== adoption.harness.skill.revision || identity.sha256 !== createHash('sha256').update(readFileSync(binary)).digest('hex')) throw new Error();
      observer = new NativeObserver({ adoptionID: consent.adoption_id, emit: send, context: {
        mode: 'L' + adoption.target.level, yolo_release: adoption.harness.skill.release, observer_version: identity.version,
        harness: { name: 'pi', version: '1.1.0' }, environment: { os: platform(), arch: arch() === 'x64' ? 'amd64' : arch() } } });
      status(ctx, 'installed; enrollment on next activity');
    } catch { status(ctx, 'unavailable'); }
  });
  pi.on('input', (event: any, ctx: any) => {
    if (!observer) return;
    try {
      const current = JSON.parse(readFileSync(join(root, '.yolo/adoption.json'), 'utf8'));
      if (current.observation?.enabled !== true || current.observation.adoption_id !== observer.adoptionID || !current.observation.acceptance?.length || current.activation?.state !== 'active') {
        observer.followup = null; status(ctx, 'off'); return;
      }
    } catch { status(ctx, 'off'); return; }
    const explicit = explicitActivity(event.text);
    const next = explicit ? { command: explicit, parent: process.env.YOLO_ADOPTION_ID === observer.adoptionID ? process.env.YOLO_ACTIVITY_ID ?? null : null } : observer.followup;
    if (!next) return;
    // Pi queued steering cannot be reliably attributed to an independent segment.
    if (!ctx.isIdle() || observer.active) { status(ctx, 'queued activity correlation unsupported'); return; }
    try {
      saved = Object.fromEntries(['YOLO_ACTIVITY_ID', 'YOLO_ACTIVITY_REPORT', 'YOLO_ADOPTION_ID'].map(k => [k, process.env[k]]));
      const id = observer.start(next.command, next.parent);
      temporary = mkdtempSync(join(tmpdir(), 'yolo-observation-')); reportPath = join(temporary, 'report.json');
      copies.push(temporary);
      if (copies.length > 16) { try { rmSync(copies.shift()!, { recursive: true }); } catch {} }
      process.env.YOLO_ACTIVITY_ID = id; process.env.YOLO_ACTIVITY_REPORT = reportPath; process.env.YOLO_ADOPTION_ID = observer.adoptionID;
      status(ctx, next.command.dry ? 'dry run; transmission suppressed' : 'observing activity');
    } catch { status(ctx, 'unavailable'); }
  });
  pi.on('message_end', (event: any) => observer?.message(event.message));
  pi.on('tool_execution_start', (event: any) => observer?.toolStart(event));
  pi.on('tool_execution_end', (event: any) => observer?.toolEnd(event));
  pi.on('agent_before_settle', (event: any) => observer?.outcome(event.outcome));
  pi.on('agent_settled', (event: any, ctx: any) => {
    if (!observer?.active) return;
    let report = null, reportStatus = 'missing';
    try {
      if (statSync(reportPath).size > 256 * 1024) reportStatus = 'invalid';
      else { report = JSON.parse(readFileSync(reportPath, 'utf8')); reportStatus = 'present'; }
    } catch (error: any) { if (error.code !== 'ENOENT') reportStatus = 'invalid'; }
    observer.finish({ aborted: event.aborted, report, reportStatus }); resetEnvironment();
    status(ctx, reportStatus === 'present' ? 'settled; sending allowlisted result' : 'settled; ' + reportStatus + ' report');
  });
  pi.on('session_shutdown', async () => {
    // Never fabricate a finish when no native settlement occurred.
    if (observer?.active) resetEnvironment();
    let timer: any;
    await Promise.race([chain, new Promise(resolve => { timer = setTimeout(resolve, 10000); })]);
    clearTimeout(timer); closing = true;
    for (const child of children) child.kill();
    // Keep bounded correlated copies in temporary storage for local diagnosis.
    observer = null;
  });
}
