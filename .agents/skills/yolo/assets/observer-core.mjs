// Native event accounting only. No prompts, continuation or authority decisions.
import { randomUUID } from 'node:crypto';
const activities = new Set(['init', 'upgrade', 'check', 'request', 'work', 'feedback']);
const identifier = () => randomUUID().replaceAll('-', '');
export function explicitActivity(text) {
  // Both documented invocation forms count: /yolo (Pi and the slash harnesses) and $yolo (Codex).
  const match = /^(?:\/yolo|\$yolo)\s+(\w+)(?:\s|$)/.exec(text);
  return match && activities.has(match[1]) ? { activity: match[1], dry: /(?:^|\s)--dry-run(?:\s|$)/.test(text) } : null;
}
export class NativeObserver {
  constructor({ adoptionID, context, emit, now = () => performance.now() }) {
    Object.assign(this, { adoptionID, context, emit, now }); this.active = null; this.followup = null;
  }
  start(command, parent = null) {
    // A lost native finish stays unknown; never invent termination.
    const id = 'activity_' + identifier();
    this.active = { id, command, parent, wall: this.now(), messages: new Set(), tools: new Set(), failures: new Set(),
      requests: 0, usage: {}, known: {}, outcome: 'completed' };
    this.followup = null;
    this.emit(this.envelope('started'), command.dry);
    return id;
  }
  envelope(phase) {
    const a = this.active;
    return { schema_version: 1, event_id: 'event_' + identifier(), activity_id: a.id,
      parent_activity_id: a.parent, adoption_id: this.adoptionID, activity: a.command.activity, phase,
      timestamp: new Date().toISOString(), context: { ...this.context, dry_run: a.command.dry } };
  }
  message(message) {
    const a = this.active; if (!a || message.role !== 'assistant') return;
    const key = message.responseId ?? message.id ?? message.timestamp ?? message;
    if (a.messages.has(key)) return; a.messages.add(key); a.requests++;
    if (message.stopReason === 'error') a.outcome = 'failed';
    const keys = { input: 'input_tokens', output: 'output_tokens', cacheRead: 'cache_read_tokens', cacheWrite: 'cache_write_tokens', reasoning: 'reasoning_tokens' };
    for (const [native, remote] of Object.entries(keys)) {
      const n = message.usage?.[native];
      if (a.known[remote] === false) continue;
      if (!Number.isSafeInteger(n) || n < 0) { a.known[remote] = false; delete a.usage[remote]; }
      else { a.known[remote] = true; a.usage[remote] = (a.usage[remote] ?? 0) + n; }
    }
  }
  toolStart(event) { if (this.active && typeof event.toolCallId === 'string') this.active.tools.add(event.toolCallId); }
  toolEnd(event) { if (this.active?.tools.has(event.toolCallId) && event.isError === true) this.active.failures.add(event.toolCallId); }
  outcome(value) {
    if (!this.active) return;
    if (value === 'error') this.active.outcome = 'failed';
    if (value === 'completed') this.active.outcome = 'completed';
  }
  finish({ aborted = false, report = null, reportStatus = 'missing' } = {}) {
    if (!this.active) return null;
    const a = this.active;
    if (reportStatus === 'present' && (report?.activity_id !== a.id || !['review', 'outcome'].includes(report?.kind))) reportStatus = 'invalid';
    const event = { ...this.envelope('finished'), execution: { status: aborted ? 'interrupted' : a.outcome, wall_ms: Math.max(0, Math.round(this.now() - a.wall)) },
      measurements: { source: 'pi-native-events', scope: 'segment', coverage: 'partial', model_requests: a.requests,
        tool_calls: a.tools.size, tool_failures: a.failures.size, models: [{ role: 'observed', requests: a.requests, ...a.usage }] },
      report_status: reportStatus, report: reportStatus === 'present' ? report : null };
    this.emit(event, a.command.dry);
    this.followup = reportStatus === 'present' && report.awaiting_input === true && !aborted ? { command: a.command, parent: a.id } : null;
    this.active = null; return event;
  }
}
