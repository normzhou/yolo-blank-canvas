import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_INTENTS,
  createNewRequestDraft,
  draftHasUserContent,
  draftIsEmpty,
  parseRequestTemplate,
  renderRequestBody,
  requestIntentLabel,
  requestTemplate,
  toYoloRequestPayload,
} from '../src/client/requestTemplates';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('request templates and body rendering (#173, #174, #175)', () => {
  it('maps the three intents onto the v0.1.0-alpha.33 yolo.* starter templates and protocols', () => {
    expect(REQUEST_INTENTS).toEqual(['feedback', 'change', 'problem']);
    expect(requestTemplate('feedback').marker).toBe('yolo.feedback@1.0.0');
    expect(requestTemplate('feedback').legacyMarker).toBe('blankcanvas.feedback@1');
    expect(requestTemplate('feedback').protocolId).toBe('yolo.feedback.resolution');

    expect(requestTemplate('change').marker).toBe('yolo.feature@1.0.0');
    expect(requestTemplate('change').legacyMarker).toBe('blankcanvas.change@1');
    expect(requestTemplate('change').protocolId).toBe('yolo.feature.resolution');

    expect(requestTemplate('problem').marker).toBe('yolo.bug@1.0.0');
    expect(requestTemplate('problem').legacyMarker).toBe('blankcanvas.problem@1');
    expect(requestTemplate('problem').protocolId).toBe('yolo.bug.resolution');

    expect(requestIntentLabel('feedback')).toBe('Share feedback');
    expect(requestIntentLabel('change')).toBe('Build or change');
    expect(requestIntentLabel('problem')).toBe('Report a problem');
  });

  it('renders a home request body with the yolo.feature@1.0.0 marker and populated optional sections', () => {
    const draft = createNewRequestDraft({ intent: 'change' });
    draft.title = 'Add keyboard shortcuts help';
    draft.details = 'Show a compact cheat sheet for the active app.';
    draft.fields.impact = 'Keyboard users can discover controls without guessing.';

    const body = renderRequestBody(draft, { build: '2302878a1ae750' });
    expect(body).toBe(
      [
        'Template: yolo.feature@1.0.0',
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
        'Template: yolo.feedback@1.0.0',
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
    expect(body).toContain('Template: yolo.bug@1.0.0');
    expect(body).toContain('## What happened?\nAudio stops after switching tabs.');
    expect(body).toContain('## How can we reproduce it?\n1. Start music\n2. Switch tabs');
    expect(body).toContain('## What did you expect?\nMusic continues or resumes cleanly.');
    expect(body).not.toContain('Build:');
  });

  it('builds schema-valid yolo.*@1.0.0 JSON payloads for all three intents', () => {
    const feedbackDraft = createNewRequestDraft({
      intent: 'feedback',
      context: 'App: Tetris (?app=tetris)',
    });
    feedbackDraft.details = 'Love the chiptunes.';
    expect(toYoloRequestPayload(feedbackDraft, { build: 'abc1234' })).toEqual({
      template: { id: 'yolo.feedback', version: '1.0.0' },
      input: {
        message: 'Love the chiptunes.',
        context: 'App: Tetris (?app=tetris)\nBuild: abc1234',
      },
    });

    const changeDraft = createNewRequestDraft({ intent: 'change' });
    changeDraft.details = 'Add a slide deck for games.';
    changeDraft.fields.impact = 'Makes games the main focus.';
    changeDraft.fields.approach = 'Carousel on the canvas.';
    expect(toYoloRequestPayload(changeDraft)).toEqual({
      template: { id: 'yolo.feature', version: '1.0.0' },
      input: {
        need: 'Add a slide deck for games.',
        impact: 'Makes games the main focus.',
        proposal: 'Carousel on the canvas.',
      },
    });

    const problemDraft = createNewRequestDraft({ intent: 'problem' });
    problemDraft.details = 'Shake is too slow.';
    problemDraft.fields.expected = 'Half amplitude, double frequency.';
    problemDraft.fields.reproduction = 'Fire 7 shots.';
    expect(toYoloRequestPayload(problemDraft)).toEqual({
      template: { id: 'yolo.bug', version: '1.0.0' },
      input: {
        observed: 'Shake is too slow.',
        expected: 'Half amplitude, double frequency.',
        reproduction: 'Fire 7 shots.',
      },
    });
  });

  it('parses yolo.*@1.0.0, legacy blankcanvas.*@1, native GitHub Issue Form, and JSON markers while preserving plain text', () => {
    expect(parseRequestTemplate('Template: yolo.feature@1.0.0\n\n## What would you like to build or change?\nX')?.templateId).toBe(
      'yolo.feature',
    );
    expect(parseRequestTemplate('App: Tetris (?app=tetris)\n\nTemplate: blankcanvas.feedback@1\n\n## What would you like us to know?\nY')).toEqual({
      marker: 'blankcanvas.feedback@1',
      templateId: 'yolo.feedback',
      version: '1.0.0',
      intent: 'feedback',
      label: 'Share feedback',
      protocolId: 'yolo.feedback.resolution@1.0.0',
    });
    expect(parseRequestTemplate('### Request template\n\nyolo.bug@1.0.0\n\n### What happened?\n\nCrash')?.templateId).toBe(
      'yolo.bug',
    );
    expect(
      parseRequestTemplate(JSON.stringify({ template: { id: 'yolo.question', version: '1.0.0' }, input: { question: 'How?' } }))
        ?.intent,
    ).toBe('question');
    expect(parseRequestTemplate('Just an ordinary plain-text GitHub issue body.')).toBeNull();
    expect(parseRequestTemplate('')).toBeNull();
  });

  it('ships the four starter GitHub Issue Form templates matching the bundled request definitions', () => {
    for (const file of [
      'yolo.feedback@1.0.0.yml',
      'yolo.feature@1.0.0.yml',
      'yolo.bug@1.0.0.yml',
      'yolo.question@1.0.0.yml',
    ]) {
      const fullPath = path.join(ROOT, '.github', 'ISSUE_TEMPLATE', file);
      expect(fs.existsSync(fullPath), `${file} missing`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content).toContain('id: yolo_template');
    }
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
