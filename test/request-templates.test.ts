import { describe, expect, it } from 'vitest';
import {
  REQUEST_INTENTS,
  createNewRequestDraft,
  draftHasUserContent,
  draftIsEmpty,
  renderRequestBody,
  requestIntentLabel,
  requestTemplate,
} from '../src/client/requestTemplates';

describe('request templates and body rendering', () => {
  it('exposes the three intents with versioned target-owned markers', () => {
    expect(REQUEST_INTENTS).toEqual(['feedback', 'change', 'problem']);
    expect(requestTemplate('feedback').marker).toBe('blankcanvas.feedback@1');
    expect(requestTemplate('change').marker).toBe('blankcanvas.change@1');
    expect(requestTemplate('problem').marker).toBe('blankcanvas.problem@1');
    expect(requestIntentLabel('feedback')).toBe('Share feedback');
    expect(requestIntentLabel('change')).toBe('Build or change');
    expect(requestIntentLabel('problem')).toBe('Report a problem');
  });

  it('renders a home request body with the marker and only populated optional sections', () => {
    const draft = createNewRequestDraft({ intent: 'change' });
    draft.title = 'Add keyboard shortcuts help';
    draft.details = 'Show a compact cheat sheet for the active app.';
    draft.fields.impact = 'Keyboard users can discover controls without guessing.';

    const body = renderRequestBody(draft, { build: '2302878a1ae750' });
    expect(body).toBe(
      [
        'Template: blankcanvas.change@1',
        '',
        '## What would you like to build or change?',
        'Show a compact cheat sheet for the active app.',
        '',
        '## Who would benefit, and how?',
        'Keyboard users can discover controls without guessing.',
        '',
        '## Context',
        'Build: 2302878a1ae750',
        '',
      ].join('\n'),
    );
  });

  it('preserves the exact #169 app context line and blank line at the top of an app request', () => {
    const draft = createNewRequestDraft({
      intent: 'feedback',
      context: 'App: Tetris (?app=tetris)',
    });
    draft.title = 'Ten columns feels tight';
    draft.details = 'The board is fun, but a wider well option would be nice.';
    draft.fields.notes = 'Played at level 4.';

    const body = renderRequestBody(draft);
    expect(body.startsWith('App: Tetris (?app=tetris)\n\n')).toBe(true);
    expect(body).toBe(
      [
        'App: Tetris (?app=tetris)',
        '',
        'Template: blankcanvas.feedback@1',
        '',
        '## What would you like us to know?',
        'The board is fun, but a wider well option would be nice.',
        '',
        '## Anything else?',
        'Played at level 4.',
        '',
      ].join('\n'),
    );
  });

  it('renders problem fields and omits unknown build identifiers', () => {
    const draft = createNewRequestDraft({ intent: 'problem' });
    draft.details = 'Audio stops after switching tabs.';
    draft.fields.reproduction = '1. Start music\n2. Switch tabs';
    draft.fields.expected = 'Music continues or resumes cleanly.';

    const body = renderRequestBody(draft, { build: 'unknown' });
    expect(body).toContain('Template: blankcanvas.problem@1');
    expect(body).toContain('## What happened?\nAudio stops after switching tabs.');
    expect(body).toContain('## How can we reproduce it?\n1. Start music\n2. Switch tabs');
    expect(body).toContain('## What did you expect?\nMusic continues or resumes cleanly.');
    expect(body).not.toContain('Build:');
  });

  it('distinguishes seeded context from user-typed content', () => {
    const home = createNewRequestDraft({ intent: 'change' });
    expect(draftHasUserContent(home)).toBe(false);
    expect(draftIsEmpty(home)).toBe(true);

    const seededApp = createNewRequestDraft({
      intent: 'feedback',
      context: 'App: Tetris (?app=tetris)',
    });
    expect(draftHasUserContent(seededApp)).toBe(false);
    expect(draftIsEmpty(seededApp)).toBe(false);

    seededApp.details = 'Great music.';
    expect(draftHasUserContent(seededApp)).toBe(true);
  });
});
