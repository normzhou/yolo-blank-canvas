import { test, expect, freezeClock, listSettled, imagesLoaded, stableFrame, type ViewportName, VIEWPORTS } from './fixtures';
import { startStubApp, makeStubGithub, densityIssues } from './stub-server';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stage 3 of the UI review (#75): the variant options.
 *
 * The maintainer said they do not have the input required to make design calls.
 * This stage is how that input gets made: each open question is rendered as real
 * screenshots of at least two named variants, over the real app with the real
 * stubbed data — not described in prose, and not left to the imagination.
 *
 * Variants are applied as CSS over the running app, so every image below is a
 * genuine render of the same DOM under a candidate style. Nothing here is a mock
 * up: if a variant looks wrong here, it will look wrong in the product.
 *
 * The winning variants are implemented properly afterwards. This file is
 * evidence for a decision, not a second stylesheet.
 */

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'review', 'variants');

type Variant = {
  /** Short name used in the filename and the issue table. */
  name: string;
  /** One line: what it does. */
  idea: string;
  /** What it costs. Recorded so the choice is argued, not asserted. */
  cost: string;
  css: string;
};

type Question = {
  id: string;
  title: string;
  finding: string;
  variants: Variant[];
  /** Which surfaces are worth photographing for this question. */
  surfaces: Array<'canvas' | 'list' | 'detail' | 'narrow-list'>;
};

/** Baseline, so every variant has something to be compared against. */
const CURRENT: Variant = {
  name: 'current',
  idea: 'The app as shipped: a fixed overlay panel over a centred prompt, toolbar order left-to-right, card list.',
  cost: '— this is the reference, not an option.',
  css: '',
};

const QUESTIONS: Question[] = [
  {
    id: 'canvas-panel',
    title: 'Canvas / panel relationship',
    finding:
      '#75 finding 4 — the prompt is centred in the viewport, so any panel width truncates it mid-sentence ("What would you like to **build**"). Visible in every desktop panel capture.',
    surfaces: ['canvas', 'list'],
    variants: [
      CURRENT,
      {
        name: 'a-centre-in-visible-area',
        idea: 'Keep the overlay, but offset the canvas content by half the panel width so the prompt stays whole while the panel is open.',
        cost: 'Smallest change that fixes the truncation, but the content is still under a scrim and the layout shifts when the panel opens — which can move text the user is reading.',
        css: `.panel:not([hidden]) ~ .canvas { padding-right: 560px; }`,
      },
      {
        name: 'b-panel-pushes-canvas',
        idea: 'Treat the panel as a column rather than an overlay: the canvas takes the remaining width and reflows, so nothing is ever covered.',
        cost: 'Nothing is hidden and no layout shift, but it is a structural change — the canvas is narrower while open, and the scrim goes away, which changes the sense of a modal.',
        css: `
          .scrim { background: none; pointer-events: none; }
          .scrim .panel { pointer-events: auto; position: fixed; }
          .canvas { padding-right: 600px; }
          .panel { box-shadow: -8px 0 24px rgba(31, 35, 40, 0.08); }
        `,
      },
    ],
  },
  {
    id: 'action-emphasis',
    title: 'Action emphasis on narrow screens',
    finding:
      '#75 finding 3 — at 390px the filter group and New request share a line and Refresh is pushed onto a line of its own, left-aligned. Refresh is what recovers a stale list, so the most orphaned control is the recovery control.',
    surfaces: ['narrow-list'],
    variants: [
      CURRENT,
      {
        name: 'a-refresh-joins-the-filters',
        idea: 'Put Refresh on the same row as the state filters, right-aligned, with the primary action beneath. Refresh sits with the state controls it recovers, and is never left alone on a line.',
        cost: 'Smallest change that actually removes the stranded control. Costs one line of vertical space at 390px, and Refresh moves away from where the desktop toolbar puts it.',
        css: `
          @media (max-width: 640px) {
            .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 8px 10px; }
            .toolbar .filter-group { grid-column: 1; grid-row: 1; justify-self: start; }
            .toolbar .spacer { display: none; }
            .toolbar button:not(.primary) { grid-column: 2; grid-row: 1; justify-self: end; }
            .toolbar button.primary { grid-column: 1 / -1; grid-row: 2; justify-self: start; }
          }
        `,
      },
      {
        name: 'b-primary-pinned-full-width',
        idea: 'Give the primary action the full width at the top on narrow, with the filters and Refresh sharing the row beneath it.',
        cost: 'The primary action is unmistakable, which is the modern-app norm; but it pushes the list down and moves Refresh away from the toolbar position desktop users know.',
        css: `
          @media (max-width: 640px) {
            .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 8px 10px; }
            .toolbar .spacer { display: none; }
            .toolbar > button.primary { grid-column: 1 / -1; grid-row: 1; width: 100%; }
            .toolbar > div.filter-group { grid-column: 1; grid-row: 2; justify-self: start; }
            .toolbar > button:not(.primary) { grid-column: 2; grid-row: 2; justify-self: end; }
          }
        `,
      },
    ],
  },
  {
    id: 'hierarchy',
    title: 'Visual hierarchy between app chrome and issue content',
    finding:
      '#75 finding 6 — the issue body\'s own Markdown headings render around 20px while the app\'s "Reported summary" label is 14px, so a person scanning for what the app is reporting competes with the issue author\'s formatting.',
    surfaces: ['detail'],
    variants: [
      CURRENT,
      {
        name: 'a-chrome-wins',
        idea: 'Cap the rendered size of headings inside the issue body so the app\'s own labels are the strongest thing in the panel.',
        cost: 'Smallest visual change, but it alters how an author\'s Markdown appears to everyone — the app would be reformatting someone else\'s writing, and the spec says the panel renders what GitHub records.',
        css: `.comment-body h1, .comment-body h2, .comment-body h3 { font-size: 15px; }`,
      },
      {
        name: 'b-summary-elevated',
        idea: 'Leave the body untouched and give the app\'s own labels a stronger treatment, so the summary box reads as the panel\'s own voice without reformatting the author\'s text.',
        cost: 'Only app chrome changes; the author\'s headings stay as written. Costs a little more vertical space in the summary box.',
        css: `
          .summary-box { border-width: 2px; padding: 14px 16px; }
          .summary-box h3 {
            font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
            color: var(--muted); margin: 0 0 10px;
          }
          .summary-box .note { font-size: 13px; }
        `,
      },
    ],
  },
  {
    id: 'list-treatment',
    title: 'List treatment and density',
    finding:
      '#75 finding 11 and the card-chrome observation — rows are white cards with a 1.29:1 border on a #f7f8fa panel, neither clearly cards nor clean dividers, and the fixed footer cuts the last row mid-card with nothing indicating more content below.',
    surfaces: ['list', 'narrow-list'],
    variants: [
      CURRENT,
      {
        name: 'a-hairline-rows',
        idea: 'Drop the card chrome for hairline dividers between rows, GitHub-style. More rows visible, calmer, less ink.',
        cost: 'Denser and quieter; loses the "each request is an object" reading, and the fixed footer still cuts a row unless paired with a scroll affordance.',
        css: `
          .issue-row { border: none; border-bottom: 1px solid var(--border); border-radius: 0; padding: 10px 4px; background: none; }
          .issue-row:last-child { border-bottom: none; }
          .issue-row button.issue-title { background: none; }
        `,
      },
      {
        name: 'b-elevated-cards',
        idea: 'Commit to cards: raise the border contrast, add a soft shadow and a hover affordance, so each row reads unmistakably as an object.',
        cost: 'Clearest per-row object; costs vertical space, so fewer rows are visible, and a card list at 30+ rows is busier than a divider list.',
        css: `
          .issue-row { border-color: #c3c9d2; box-shadow: 0 1px 2px rgba(31, 35, 40, 0.06); transition: box-shadow 120ms ease; }
          .issue-row:hover { box-shadow: 0 2px 6px rgba(31, 35, 40, 0.10); }
        `,
      },
    ],
  },
];

async function openList(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Requests', exact: true }).click();
  await listSettled(page);
}

async function openDetail(page: import('@playwright/test').Page) {
  await openList(page);
  await page.getByRole('button', { name: '#7 Make the canvas respond to themes' }).click();
  await expect(page.getByRole('heading', { name: 'Reported summary', exact: true })).toBeVisible();
}

async function shoot(page: import('@playwright/test').Page, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await imagesLoaded(page);
  await stableFrame(page);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
}

for (const question of QUESTIONS) {
  for (const surface of question.surfaces) {
    const viewport: ViewportName = surface === 'narrow-list' ? 'narrow' : 'desktop';
    const density = surface === 'list' || surface === 'narrow-list';

    for (const variant of question.variants) {
      test(`${question.id} — ${surface} — ${variant.name}`, async ({ page }) => {
        const stub = await startStubApp(density ? makeStubGithub({ issues: densityIssues() }) : makeStubGithub());
        try {
          await freezeClock(page);
          await page.setViewportSize(VIEWPORTS[viewport]);
          await page.goto(stub.base);
          if (variant.css) await page.addStyleTag({ content: variant.css });

          if (surface === 'canvas') {
            await expect(page.getByText('What would you like to build or change?')).toBeVisible();
            await shoot(page, path.join(OUT, question.id, `${variant.name}-${surface}.png`));
            if (question.id === 'canvas-panel') {
              // The point of this question is what happens with the panel open.
              await openList(page);
              await shoot(page, path.join(OUT, question.id, `${variant.name}-${surface}-panel-open.png`));
            }
          } else if (surface === 'detail') {
            await openDetail(page);
            await shoot(page, path.join(OUT, question.id, `${variant.name}-${surface}.png`));
          } else {
            await openList(page);
            await shoot(page, path.join(OUT, question.id, `${variant.name}-${surface}.png`));
          }
        } finally {
          stub.server.close();
        }
      });
    }
  }
}
