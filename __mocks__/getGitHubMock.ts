/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GitHub } from '../src/types/GitHub.js';

export function getGitHubMock() {
  const createReleaseSpy = vi.fn();
  const getLatestReleaseSpy = vi.fn();
  const listPullRequestsAssociatedWithCommitSpy = vi.fn();

  const getOctokitSpy = vi.fn((_token: string) => {
    return {
      rest: {
        repos: {
          createRelease: createReleaseSpy,
          getLatestRelease: getLatestReleaseSpy,
          listPullRequestsAssociatedWithCommit: listPullRequestsAssociatedWithCommitSpy,
        },
      },
    } as any;
  });

  const gitHubMock = {
    context: {
      sha: '<sha>',
      repo: { owner: '<owner>', repo: '<repo>' },
      ref: '<ref>',
      actor: '<actor>',
    },
    getOctokit: getOctokitSpy,
  } satisfies GitHub;

  return {
    gitHubMock,
    getOctokitSpy,
    createReleaseSpy,
    getLatestReleaseSpy,
    listPullRequestsAssociatedWithCommitSpy,
  };
}
