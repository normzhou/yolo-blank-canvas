/**
 * Request capture vocabulary.
 *
 * The app asks for one of three intents, then renders the answers into an
 * ordinary issue body. The markers are target-owned and versioned so a later
 * upstream template adoption can map them deliberately instead of guessing.
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

interface RequestTemplate {
  intent: RequestIntent;
  label: string;
  hint: string;
  marker: string;
  primaryLabel: string;
  primaryHint: string;
  secondary?: RequestFieldSpec;
  more: RequestFieldSpec[];
}

const TEMPLATES: Record<RequestIntent, RequestTemplate> = {
  feedback: {
    intent: 'feedback',
    label: 'Share feedback',
    hint: 'What worked, what did not, or what surprised you.',
    marker: 'blankcanvas.feedback@1',
    primaryLabel: 'What would you like us to know?',
    primaryHint: 'No solution is required.',
    more: [],
  },
  change: {
    intent: 'change',
    label: 'Build or change',
    hint: 'A capability or behavior you want.',
    marker: 'blankcanvas.change@1',
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
    marker: 'blankcanvas.problem@1',
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
