import { describe, expect, it } from 'vitest';
import { appContextLine, feedbackBody } from '../src/client/feedback';

const NL = String.fromCharCode(10);

describe('app feedback context', () => {
  it('names the app and its route in one visible line', () => {
    expect(appContextLine({ id: 'prism-stack', title: 'Prism Stack' })).toBe(
      'App: Prism Stack (?app=prism-stack)',
    );
  });

  it('starts a new feedback body with the context and a blank line', () => {
    expect(feedbackBody({ id: 'prism-stack', title: 'Prism Stack' })).toBe(
      `App: Prism Stack (?app=prism-stack)${NL}${NL}`,
    );
  });
});
