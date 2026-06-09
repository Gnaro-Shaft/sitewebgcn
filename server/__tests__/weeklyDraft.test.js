// Tests for the weekly auto-draft GitHub fetcher.
// We mock global.fetch so no real network call is made.
//
// New strategy: the function uses 2 endpoints
//   1. /users/:u/repos (list)
//   2. /repos/:u/:r/commits (per repo)
// We script the mock to return the right payload per URL.

import { describe, it, expect, vi, afterEach } from 'vitest';

process.env.AI_MONTHLY_BUDGET_USD = '5';
process.env.AI_YEARLY_BUDGET_USD = '50';

const { fetchRecentGithubActivity } = require('../services/AIAgent');

const origFetch = global.fetch;

afterEach(() => {
  global.fetch = origFetch;
});

// Build a fetch mock that returns different payloads based on the URL.
// Each rule is { match: substring, body, ok }.
function fetchByUrl(rules) {
  return vi.fn(async (url) => {
    for (const rule of rules) {
      if (url.includes(rule.match)) {
        return {
          ok: rule.ok !== false,
          json: async () => rule.body,
        };
      }
    }
    return { ok: false, json: async () => null };
  });
}

describe('fetchRecentGithubActivity', () => {
  it('returns empty when user is missing — no network call', async () => {
    global.fetch = vi.fn();
    const result = await fetchRecentGithubActivity({});
    expect(result).toEqual({ commits: [], repos: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty when the repo list endpoint fails', async () => {
    global.fetch = fetchByUrl([{ match: '/users/', body: null, ok: false }]);
    const result = await fetchRecentGithubActivity({ user: 'octocat' });
    expect(result).toEqual({ commits: [], repos: [] });
  });

  it('returns empty when fetch throws (network down)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await fetchRecentGithubActivity({ user: 'octocat' });
    expect(result).toEqual({ commits: [], repos: [] });
  });

  it('aggregates commits across multiple recently-pushed repos', async () => {
    const now = new Date();
    const recent = now.toISOString();
    global.fetch = fetchByUrl([
      {
        match: '/users/me/repos',
        body: [
          { full_name: 'me/repoA', pushed_at: recent, fork: false, archived: false },
          { full_name: 'me/repoB', pushed_at: recent, fork: false, archived: false },
        ],
      },
      {
        match: '/repos/me/repoA/commits',
        body: [
          { commit: { message: 'Add feature X', author: { date: recent } } },
          { commit: { message: 'Fix bug Y', author: { date: recent } } },
        ],
      },
      {
        match: '/repos/me/repoB/commits',
        body: [
          { commit: { message: 'Bump deps', author: { date: recent } } },
        ],
      },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me' });

    expect(result.commits).toHaveLength(3);
    expect(result.repos).toEqual(expect.arrayContaining(['me/repoA', 'me/repoB']));
    expect(result.commits.map((c) => c.message)).toEqual(
      expect.arrayContaining(['Add feature X', 'Fix bug Y', 'Bump deps'])
    );
  });

  it('drops merge commits (avoid noise in the AI context)', async () => {
    const now = new Date().toISOString();
    global.fetch = fetchByUrl([
      {
        match: '/users/',
        body: [{ full_name: 'me/r', pushed_at: now, fork: false, archived: false }],
      },
      {
        match: '/commits',
        body: [
          { commit: { message: 'Real work', author: { date: now } } },
          { commit: { message: 'Merge pull request #42', author: { date: now } } },
          { commit: { message: 'Merge branch main', author: { date: now } } },
        ],
      },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me' });
    expect(result.commits.map((c) => c.message)).toEqual(['Real work']);
  });

  it('excludes forks and archived repos', async () => {
    const now = new Date().toISOString();
    global.fetch = fetchByUrl([
      {
        match: '/users/',
        body: [
          { full_name: 'me/active', pushed_at: now, fork: false, archived: false },
          { full_name: 'me/fork', pushed_at: now, fork: true, archived: false },
          { full_name: 'me/archive', pushed_at: now, fork: false, archived: true },
        ],
      },
      {
        match: '/repos/me/active/commits',
        body: [{ commit: { message: 'Active commit', author: { date: now } } }],
      },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me' });
    expect(result.repos).toEqual(['me/active']);
    expect(result.commits).toHaveLength(1);
  });

  it('excludes repos last pushed before the window', async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    global.fetch = fetchByUrl([
      {
        match: '/users/',
        body: [
          { full_name: 'me/recent', pushed_at: now, fork: false, archived: false },
          { full_name: 'me/stale', pushed_at: old, fork: false, archived: false },
        ],
      },
      {
        match: '/repos/me/recent/commits',
        body: [{ commit: { message: 'Fresh commit', author: { date: now } } }],
      },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me', sinceDays: 7 });
    expect(result.repos).toEqual(['me/recent']);
    expect(result.commits).toHaveLength(1);
  });

  it('caps commit messages at 200 chars and keeps only the first line', async () => {
    const now = new Date().toISOString();
    const multiLine = 'First line summary\nBody paragraph here\nMore body';
    const tooLong = 'X'.repeat(500);
    global.fetch = fetchByUrl([
      {
        match: '/users/',
        body: [{ full_name: 'me/r', pushed_at: now, fork: false, archived: false }],
      },
      {
        match: '/commits',
        body: [
          { commit: { message: multiLine, author: { date: now } } },
          { commit: { message: tooLong, author: { date: now } } },
        ],
      },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me' });
    expect(result.commits[0].message).toBe('First line summary');
    expect(result.commits[1].message.length).toBe(200);
  });

  it('caps the total commit list at 30 (context size guard)', async () => {
    const now = new Date().toISOString();
    const manyCommits = Array.from({ length: 50 }, (_, i) => ({
      commit: { message: `Commit ${i}`, author: { date: now } },
    }));
    global.fetch = fetchByUrl([
      {
        match: '/users/',
        body: [{ full_name: 'me/r', pushed_at: now, fork: false, archived: false }],
      },
      { match: '/commits', body: manyCommits },
    ]);

    const result = await fetchRecentGithubActivity({ user: 'me' });
    expect(result.commits.length).toBe(30);
  });
});
