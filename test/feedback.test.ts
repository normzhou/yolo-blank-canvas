import { describe, expect, it } from 'vitest';
import { appContextLine, feedbackBody } from '../src/client/feedback';

describe('app feedback context', () => {
  it('names the app and its route in one visible line', () => {
    expect(appContextLine({ id: 'tetris', title: 'Tetris' })).toBe('App: Tetris (?app=tetris)');
  });

  it('starts a new feedback body with the context and a blank line', () => {
    expect(feedbackBody({ id: 'tetris', title: 'Tetris' })).toBe('App: Tetris (?app=tetris)\n\n');
  });
});
