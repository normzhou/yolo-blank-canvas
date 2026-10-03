#!/usr/bin/env node
/**
 * yolo-blank-canvas launcher.
 *
 *   npx --yes github:normzhou/yolo-blank-canvas#v0.1.0
 *   npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --repo owner/name
 *
 * Checks prerequisites, makes sure GitHub CLI is authenticated, picks a loopback
 * port, serves the built UI and local API together, and opens the browser.
 */
import process from 'node:process';
import { createApp, LOGIN_COMMAND } from './app.js';
import { buildInfo } from './build.js';
import { parseTarget, GhError } from './gh.js';
import { requireGh, connectWithCli, confirmRepoAccess, findPort, openBrowser } from './launch.js';
import { createGithubClient } from './github.js';

const DEFAULT_REPO = 'normzhou/yolo-blank-canvas';
const DEFAULT_PORT = 4317;

function parseArgs(argv) {
  const options = { repo: DEFAULT_REPO, port: DEFAULT_PORT, open: true, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo' || arg === '-r') {
      options.repo = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length);
    } else if (arg === '--port' || arg === '-p') {
      options.port = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      options.port = Number.parseInt(arg.slice('--port='.length), 10);
    } else if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }
  return options;
}

function usage() {
  return [
    'yolo-blank-canvas — a blank canvas with a Requests overlay over one GitHub repository.',
    '',
    'Usage:',
    '  yolo-blank-canvas [--repo <owner>/<repo>] [--port <number>] [--no-open]',
    '',
    'Prerequisites:',
    '  Node.js 20.10+ / npm, and GitHub CLI (gh) authenticated for github.com.',
    '',
    'Examples:',
    '  npx --yes github:normzhou/yolo-blank-canvas#v0.1.0',
    '  npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --repo normzhou/yolo-blank-canvas',
    '',
    `If GitHub CLI is not authenticated, run: ${LOGIN_COMMAND}`,
  ].join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }

  const target = parseTarget(options.repo);
  const identity = buildInfo();

  try {
    await requireGh();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const account = await connectWithCli({ log: (message) => console.error(message) });
  if (!account) {
    process.exitCode = 1;
    return;
  }

  try {
    await confirmRepoAccess(target);
  } catch (error) {
    console.error(error instanceof GhError ? error.message : 'Could not confirm repository access.');
    process.exitCode = 1;
    return;
  }

  const app = createApp({ target, github: createGithubClient() });
  const port = await findPort(Number.isInteger(options.port) ? options.port : DEFAULT_PORT);
  const url = `http://localhost:${port}`;

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`yolo-blank-canvas ${identity.serverBuild === 'unknown' ? '' : `(${identity.serverBuild})`}`.trim());
    console.log(`  repository: ${target.slug}`);
    console.log(`  signed in as: ${account.login} (via GitHub CLI)`);
    console.log(`  ${url}`);
    if (options.open) {
      openBrowser(url);
      console.log('  Opened in your browser. If it did not open, use the URL above.');
    } else {
      console.log(`  Open ${url}`);
    }
    console.log('  Press Ctrl-C to stop.');
  });

  const shutdown = (signal) => {
    console.log(`\nStopping (${signal})...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error?.message || 'Failed to start yolo-blank-canvas.');
  process.exitCode = 1;
});