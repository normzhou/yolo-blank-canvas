/**
 * The only GitHub operations this app exposes: list/get issues, list comments,
 * create issue, create comment. Every path is fixed-host and repository-scoped.
 */
import { runGhApi, validateIssueNumber, ValidationError } from './gh.js';

const PER_PAGE = 30;

export function isPullRequest(item) {
  return Boolean(item && item.pull_request);
}

export function createGithubClient({ runner = runGhApi } = {}) {
  async function repoPath(target, suffix) {
    return `repos/${target.owner}/${target.name}${suffix}`;
  }

  return {
    async listIssues(target, { state = 'open', page = 1, perPage = PER_PAGE } = {}) {
      const safeState = state === 'closed' || state === 'all' ? state : 'open';
      const path = await repoPath(
        target,
        `/issues?state=${safeState}&sort=updated&direction=desc&per_page=${Math.min(Math.max(Number(perPage) || PER_PAGE, 1), 100)}&page=${Math.max(Number(page) || 1, 1)}`,
      );
      const items = await runner([path]);
      // Issue listings include pull requests; the app is an issue view only.
      return (Array.isArray(items) ? items : []).filter((item) => !isPullRequest(item));
    },

    async getIssue(target, number) {
      const issue = await runner([await repoPath(target, `/issues/${validateIssueNumber(number)}`)]);
      if (isPullRequest(issue)) throw new ValidationError('That number is a pull request, not an issue.');
      return issue;
    },

    async createIssue(target, { title, body }) {
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      if (!cleanTitle) throw new ValidationError('A title is required.');
      if (cleanTitle.length > 256) throw new ValidationError('Title is too long (max 256 characters).');
      const cleanBody = typeof body === 'string' ? body.trim() : '';
      if (cleanBody.length > 65_536) throw new ValidationError('Description is too long.');
      return runner(
        [await repoPath(target, '/issues'), '--method', 'POST', '--input', '-'],
        { input: JSON.stringify({ title: cleanTitle, body: cleanBody }) },
      );
    },

    async listComments(target, number, { page = 1, perPage = PER_PAGE } = {}) {
      const path = await repoPath(
        target,
        `/issues/${validateIssueNumber(number)}/comments?per_page=${Math.min(Math.max(Number(perPage) || PER_PAGE, 1), 100)}&page=${Math.max(Number(page) || 1, 1)}`,
      );
      const items = await runner([path]);
      return Array.isArray(items) ? items : [];
    },

    async createComment(target, number, { body }) {
      const cleanBody = typeof body === 'string' ? body.trim() : '';
      if (!cleanBody) throw new ValidationError('A reply cannot be empty.');
      if (cleanBody.length > 65_536) throw new ValidationError('Reply is too long.');
      return runner(
        [await repoPath(target, `/issues/${validateIssueNumber(number)}/comments`), '--method', 'POST', '--input', '-'],
        { input: JSON.stringify({ body: cleanBody }) },
      );
    },
  };
}