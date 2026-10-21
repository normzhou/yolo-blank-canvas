/**
 * The request-store seam.
 *
 * Routes depend on this app-shaped port, not on a particular record backend.
 * Today the only adapter is GitHub; a future store can implement the same
 * operations without changing the API, the UI, or `gh.js`.
 *
 * The port deliberately stays small: list/get requests, create a request,
 * list/create comments, and the provider identity/links the app needs for
 * recovery copy. Records keep the evidence the status contract consumes —
 * `state`, `labels`, timestamps, and ordinary comments.
 */
import { createGithubClient } from './github.js';

/**
 * @typedef {Object} RequestStore
 * @property {() => {provider: string, displayName: string, repository: string, visibility: string}} identity
 * @property {() => {comments: boolean, labels: boolean, externalLinks: boolean}} capabilities
 * @property {(number: number|string) => string} requestUrl
 * @property {() => string} requestsUrl
 * @property {(query?: {state?: string, page?: number, perPage?: number}) => Promise<{items: unknown[], hasMore: boolean}>} listRequests
 * @property {(number: number|string) => Promise<unknown>} getRequest
 * @property {(input: {title?: string, body?: string}) => Promise<unknown>} createRequest
 * @property {(number: number|string, query?: {page?: number, perPage?: number}) => Promise<unknown[]>} listComments
 * @property {(number: number|string, input: {body?: string}) => Promise<unknown>} createComment
 */

/**
 * GitHub remains the only record backend today. This adapter fixes the target
 * at creation so routes and the browser can never choose a repository.
 *
 * @param {{target: {owner: string, name: string, slug: string}, github?: ReturnType<typeof createGithubClient>}} options
 * @returns {RequestStore}
 */
export function createGitHubRequestStore({ target, github = createGithubClient() }) {
  if (!target) throw new TypeError('A target repository is required.');

  return {
    identity() {
      return {
        provider: 'github',
        displayName: 'GitHub',
        repository: target.slug,
        // Records inherit the repository's visibility; this adapter does not
        // attempt to discover whether that repository is public or private.
        visibility: 'repository',
      };
    },

    capabilities() {
      return { comments: true, labels: true, externalLinks: true };
    },

    requestUrl(number) {
      return `https://github.com/${target.slug}/issues/${number}`;
    },

    requestsUrl() {
      return `https://github.com/${target.slug}/issues`;
    },

    async listRequests({ state = 'open', page = 1, perPage = 30 } = {}) {
      return github.listIssues(target, { state, page, perPage });
    },

    async getRequest(number) {
      return github.getIssue(target, number);
    },

    async createRequest({ title, body }) {
      return github.createIssue(target, { title, body });
    },

    async listComments(number, { page = 1, perPage = 30 } = {}) {
      return github.listComments(target, number, { page, perPage });
    },

    async createComment(number, { body }) {
      return github.createComment(target, number, { body });
    },
  };
}
