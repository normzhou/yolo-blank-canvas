/**
 * Request capture vocabulary (#173, #174, #175).
 *
 * Maps the app's three guided intents onto the adopted `v0.1.0-alpha.33`
 * YOLO Dev starter templates (`yolo.feedback@1.0.0`, `yolo.feature@1.0.0`,
 * `yolo.bug@1.0.0`) and their bound resolution protocols, while retaining
 * backward-compatible recognition of earlier `blankcanvas.*@1` markers and
 * plain-text issues.
 */
export type RequestIntent = 'feedback' | 'change' | 'problem';
export type RequestMode = 'guided' | 'freeform';
export type RequestField = 'impact' | 'approach' | 'reproduction' | 'expected' | 'notes';

export interface RequestFields {
  impact: string;
  approach: string;
  reproduction: string;
  expected: string;
  notes: string;
}

export interface NewRequestDraft {
  version: 2;
  mode: RequestMode;
  intent: RequestIntent;
  title: string;
  /** The one required answer shared by all three intents. */
  details: string;
  fields: RequestFields;
  /** The editable app line that must stay first in the issue body (#169). */
  context: string;
  /** Used only in freeform mode. */
  body: string;
}

interface RequestFieldSpec {
  key: RequestField;
  label: string;
  hint: string;
}

export interface RequestTemplate {
  intent: RequestIntent;
  label: string;
  hint: string;
  /** Official v0.1.0-alpha.33 template marker (`<id>@<version>`). */
  marker: string;
  /** Earlier target-owned marker retained for backward compatibility (#174). */
  legacyMarker: string;
  templateId: 'yolo.feedback' | 'yolo.feature' | 'yolo.bug';
  templateVersion: '1.0.0';
  protocolId: 'yolo.feedback.resolution' | 'yolo.feature.resolution' | 'yolo.bug.resolution';
  protocolVersion: '1.0.0';
  primaryLabel: string;
  primaryHint: string;
  secondary?: RequestFieldSpec;
  more: RequestFieldSpec[];
}

export interface YoloRequestPayload {
  template: {
    id: 'yolo.feedback' | 'yolo.feature' | 'yolo.bug';
    version: '1.0.0';
  };
  input: Record<string, string>;
}

export interface ParsedRequestTemplate {
  marker: string;
  templateId: string;
  version: string;
  intent: RequestIntent | 'question';
  label: string;
  protocolId: string;
}

const TEMPLATES: Record<RequestIntent, RequestTemplate> = {
  feedback: {
    intent: 'feedback',
    label: 'Share feedback',
    hint: 'What worked, what did not, or what surprised you.',
    marker: 'yolo.feedback@1.0.0',
    legacyMarker: 'blankcanvas.feedback@1',
    templateId: 'yolo.feedback',
    templateVersion: '1.0.0',
    protocolId: 'yolo.feedback.resolution',
    protocolVersion: '1.0.0',
    primaryLabel: 'What would you like us to know?',
    primaryHint: 'No solution is required.',
    more: [],
  },
  change: {
    intent: 'change',
    label: 'Build or change',
    hint: 'A capability or behavior you want.',
    marker: 'yolo.feature@1.0.0',
    legacyMarker: 'blankcanvas.change@1',
    templateId: 'yolo.feature',
    templateVersion: '1.0.0',
    protocolId: 'yolo.feature.resolution',
    protocolVersion: '1.0.0',
    primaryLabel: 'What would you like to build or change?',
    primaryHint: 'Describe the need or desired outcome.',
    secondary: {
      key: 'impact',
      label: 'Who would benefit, and how?',
      hint: 'Optional. A sentence is plenty.',
    },
    more: [
      {
        key: 'approach',
        label: 'Suggested approach',
        hint: 'Optional. An idea, not a requirement.',
      },
    ],
  },
  problem: {
    intent: 'problem',
    label: 'Report a problem',
    hint: 'Something broken, confusing, or not working as expected.',
    marker: 'yolo.bug@1.0.0',
    legacyMarker: 'blankcanvas.problem@1',
    templateId: 'yolo.bug',
    templateVersion: '1.0.0',
    protocolId: 'yolo.bug.resolution',
    protocolVersion: '1.0.0',
    primaryLabel: 'What happened?',
    primaryHint: 'Describe what you observed.',
    secondary: {
      key: 'reproduction',
      label: 'How can we reproduce it?',
      hint: 'Optional. Steps, if you know them.',
    },
    more: [
      {
        key: 'expected',
        label: 'What did you expect?',
        hint: 'Optional.',
      },
    ],
  },
};

export const REQUEST_INTENTS: RequestIntent[] = ['feedback', 'change', 'problem'];

export function isRequestIntent(value: unknown): value is RequestIntent {
  return value === 'feedback' || value === 'change' || value === 'problem';
}

export function requestTemplate(intent: RequestIntent): RequestTemplate {
  return TEMPLATES[intent];
}

export function requestIntentLabel(intent: RequestIntent): string {
  return TEMPLATES[intent].label;
}

export const NOTES_FIELD: RequestFieldSpec = {
  key: 'notes',
  label: 'Anything else?',
  hint: 'Optional. Context, constraints, or links.',
};

export function emptyRequestFields(): RequestFields {
  return { impact: '', approach: '', reproduction: '', expected: '', notes: '' };
}

export function createNewRequestDraft({
  intent,
  context = '',
}: {
  intent: RequestIntent;
  context?: string;
}): NewRequestDraft {
  return {
    version: 2,
    mode: 'guided',
    intent,
    title: '',
    details: '',
    fields: emptyRequestFields(),
    context,
    body: '',
  };
}

/**
 * True when the user has typed something beyond the seeded app context. Entry
 * defaults may replace an untouched seeded draft, but never typed input.
 */
export function draftHasUserContent(draft: NewRequestDraft): boolean {
  return (
    draft.title.trim() !== '' ||
    draft.details.trim() !== '' ||
    Object.values(draft.fields).some((value) => value.trim() !== '') ||
    draft.body.trim() !== ''
  );
}

/** True when there is nothing worth restoring from storage. */
export function draftIsEmpty(draft: NewRequestDraft): boolean {
  return !draftHasUserContent(draft) && draft.context.trim() === '';
}

function buildContextString(draft: NewRequestDraft, build: string): string {
  const parts: string[] = [];
  const context = draft.context.trim();
  if (context) parts.push(context);
  const notes = draft.fields.notes.trim();
  if (notes) parts.push(notes);
  const cleanBuild = build.trim();
  if (cleanBuild && cleanBuild !== 'unknown') {
    parts.push(`Build: ${cleanBuild}`);
  }
  return parts.join('\n');
}

/**
 * Produces a schema-valid `v0.1.0-alpha.33` YOLO Dev request payload
 * (`yolo-check requests normalize --format json`) for the guided draft (#174).
 */
export function toYoloRequestPayload(
  draft: NewRequestDraft,
  { build = '' }: { build?: string } = {},
): YoloRequestPayload {
  const template = TEMPLATES[draft.intent];
  const details = draft.details.trim();
  const contextValue = buildContextString(draft, build);
  const input: Record<string, string> = {};

  if (draft.intent === 'feedback') {
    input.message = details;
  } else if (draft.intent === 'change') {
    input.need = details;
    const impact = draft.fields.impact.trim();
    if (impact) input.impact = impact;
    const proposal = draft.fields.approach.trim();
    if (proposal) input.proposal = proposal;
  } else {
    input.observed = details;
    const expected = draft.fields.expected.trim();
    if (expected) input.expected = expected;
    const reproduction = draft.fields.reproduction.trim();
    if (reproduction) input.reproduction = reproduction;
  }

  if (contextValue) {
    input.context = contextValue;
  }

  return {
    template: {
      id: template.templateId,
      version: template.templateVersion,
    },
    input,
  };
}

/**
 * Render the generated issue body. `build` is omitted when the build identity
 * is unavailable so development builds do not print `Build: unknown`.
 */
export function renderRequestBody(draft: NewRequestDraft, { build = '' }: { build?: string } = {}): string {
  const template = TEMPLATES[draft.intent];
  const sections: string[] = [];
  const context = draft.context.trim();
  const header = context ? `${context}\n\nTemplate: ${template.marker}` : `Template: ${template.marker}`;
  sections.push(header);
  sections.push(`## ${template.primaryLabel}\n${draft.details.trim()}`);

  if (template.secondary) {
    const value = draft.fields[template.secondary.key].trim();
    if (value) sections.push(`## ${template.secondary.label}\n${value}`);
  }

  for (const field of template.more) {
    const value = draft.fields[field.key].trim();
    if (value) sections.push(`## ${field.label}\n${value}`);
  }

  const notes = draft.fields.notes.trim();
  if (notes) sections.push(`## ${NOTES_FIELD.label}\n${notes}`);

  const cleanBuild = build.trim();
  if (cleanBuild && cleanBuild !== 'unknown') {
    sections.push(`## Context\nBuild: ${cleanBuild}`);
  }

  return `${sections.join('\n\n').trimEnd()}\n`;
}

const MARKER_MAP: Record<string, ParsedRequestTemplate> = {
  'yolo.feedback@1.0.0': {
    marker: 'yolo.feedback@1.0.0',
    templateId: 'yolo.feedback',
    version: '1.0.0',
    intent: 'feedback',
    label: 'Share feedback',
    protocolId: 'yolo.feedback.resolution@1.0.0',
  },
  'yolo.feature@1.0.0': {
    marker: 'yolo.feature@1.0.0',
    templateId: 'yolo.feature',
    version: '1.0.0',
    intent: 'change',
    label: 'Build or change',
    protocolId: 'yolo.feature.resolution@1.0.0',
  },
  'yolo.bug@1.0.0': {
    marker: 'yolo.bug@1.0.0',
    templateId: 'yolo.bug',
    version: '1.0.0',
    intent: 'problem',
    label: 'Report a problem',
    protocolId: 'yolo.bug.resolution@1.0.0',
  },
  'yolo.question@1.0.0': {
    marker: 'yolo.question@1.0.0',
    templateId: 'yolo.question',
    version: '1.0.0',
    intent: 'question',
    label: 'Ask a question',
    protocolId: 'yolo.question.resolution@1.0.0',
  },
  'blankcanvas.feedback@1': {
    marker: 'blankcanvas.feedback@1',
    templateId: 'yolo.feedback',
    version: '1.0.0',
    intent: 'feedback',
    label: 'Share feedback',
    protocolId: 'yolo.feedback.resolution@1.0.0',
  },
  'blankcanvas.change@1': {
    marker: 'blankcanvas.change@1',
    templateId: 'yolo.feature',
    version: '1.0.0',
    intent: 'change',
    label: 'Build or change',
    protocolId: 'yolo.feature.resolution@1.0.0',
  },
  'blankcanvas.problem@1': {
    marker: 'blankcanvas.problem@1',
    templateId: 'yolo.bug',
    version: '1.0.0',
    intent: 'problem',
    label: 'Report a problem',
    protocolId: 'yolo.bug.resolution@1.0.0',
  },
};

/**
 * Recognises an adopted `yolo.*@1.0.0` or legacy `blankcanvas.*@1` template
 * marker in an issue body (composer `Template: <marker>`, native GitHub Issue
 * Form `### Request template`, or JSON `{template:{id,version}}`). Plain-text
 * issues without a recognized marker return `null`.
 */
export function parseRequestTemplate(body: string | null | undefined): ParsedRequestTemplate | null {
  if (typeof body !== 'string' || body.trim() === '') return null;
  const trimmed = body.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { template?: { id?: string; version?: string } };
      if (parsed?.template?.id && parsed?.template?.version) {
        const key = `${parsed.template.id}@${parsed.template.version}`;
        if (MARKER_MAP[key]) return MARKER_MAP[key];
      }
    } catch {
      // Not JSON; fall through to Markdown inspection.
    }
  }

  const inlineMatch = /^Template:\s*([a-z0-9_.@-]+)\s*$/m.exec(body);
  if (inlineMatch && MARKER_MAP[inlineMatch[1]]) {
    return MARKER_MAP[inlineMatch[1]];
  }

  const formMatch = /^###\s+Request template\s*\n+\s*([a-z0-9_.@-]+)\s*$/m.exec(body);
  if (formMatch && MARKER_MAP[formMatch[1]]) {
    return MARKER_MAP[formMatch[1]];
  }

  return null;
}
