import fs from 'node:fs';
import path from 'node:path';
import { RequestError } from '@octokit/request-error';
import yaml from 'yaml';
import { getGitHubMock } from '../mocks/getGitHubMock.js';
import { getGitMock } from '../mocks/getGitMock.js';
import { getLoggerMock } from '../mocks/getLoggerMock.js';
import { WorkflowMock } from '../mocks/WorkflowMock.js';
import { GitHistoryEntry, GitService } from '../services/GitService.js';
import { run } from './run.js';

function makeGitHistory(values?: Partial<GitHistoryEntry>): GitHistoryEntry {
  return {
    hash: '<hash>',
    date: '<date>',
    message: '<message>',
    refs: '<refs>',
    body: '<body>',
    author_name: '<author_name>',
    author_email: '<author_email>',
    ...values,
  };
}

describe(run.name, () => {
  const actionFilePath = path.join(import.meta.dirname, '..', '..', 'action.yml');
  const actionFile = yaml.parse(fs.readFileSync(actionFilePath).toString());

  const loggerMock = getLoggerMock();
  const gitMock = getGitMock();
  const execMock = vi.fn();

  const { gitHubMock, getOctokitSpy, createReleaseSpy, getLatestReleaseSpy, listPullRequestsAssociatedWithCommitSpy } =
    getGitHubMock();
  const workflow = new WorkflowMock();
  const git = new GitService(loggerMock, gitMock);
  const setFailedSpy = vi.spyOn(workflow, 'setFailed');
  const setOutputSpy = vi.spyOn(workflow, 'setOutput');

  const repoDir = path.join('/', 'repo');

  const getHistorySpy = vi.spyOn(git, 'getHistory');
  const getBranchesSpy = vi.spyOn(git, 'getBranches');
  const statusSpy = vi.spyOn(git, 'status');
  const mergeSpy = vi.spyOn(git, 'merge');
  const setUserSpy = vi.spyOn(git, 'setUser');
  const addTagsSpy = vi.spyOn(git, 'addTags');
  const switchSpy = vi.spyOn(git, 'switch');
  const pushTagsSpy = vi.spyOn(git, 'pushTags');
  const amendCommitWithAllFilesSpy = vi.spyOn(git, 'amendCommitWithAllFiles');
  const commitAllFilesSpy = vi.spyOn(git, 'commitAllFiles');
  const pushToRemoteSpy = vi.spyOn(git, 'pushToRemote');

  beforeEach(() => {
    vi.stubEnv('GITHUB_WORKSPACE', repoDir);
    workflow.reset(true);
    getHistorySpy.mockResolvedValue([makeGitHistory()]);
    getBranchesSpy.mockResolvedValue({
      detached: false,
      current: 'current',
      all: [`remotes/origin/develop`, `remotes/origin/release`],
      branches: {},
    });
    getLatestReleaseSpy.mockResolvedValue({ data: { tag_name: 'v1.0.0' } });
    statusSpy.mockResolvedValue({ isClean: false } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('should set all of the output values defined in the action.yml file', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const actual = setOutputSpy.mock.calls.map(([x]) => x).toSorted();
    const expected = Object.keys(actionFile.outputs).toSorted();
    expect(actual).toStrictEqual(expected);
  });

  it('should fail with an Error if the "GITHUB_WORKSPACE" env var is not set', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- Typedef requires a value
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = new Error(
      'Unable to retrieve the current working directory using environment variable "GITHUB_WORKSPACE".',
    );
    expect(setFailedSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should pass the GitHub token to the Octokit', async () => {
    const token = '<myGitHubToken>';
    workflow.setInputValue('github-token', token);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(getOctokitSpy).toHaveBeenCalledExactlyOnceWith(token);
  });

  it('should use the context ref as the initialBranch when the GITHUB_HEAD_REF and GITHUB_REF_NAME are not set', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- Typedef requires a value
    vi.stubEnv('GITHUB_HEAD_REF', undefined);
    // eslint-disable-next-line unicorn/no-useless-undefined -- Typedef requires a value
    vi.stubEnv('GITHUB_REF_NAME', undefined);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).toHaveBeenCalledExactlyOnceWith(gitHubMock.context.ref, expect.anything());
  });

  it('should use the GITHUB_REF_NAME as the initialBranch when the GITHUB_HEAD_REF is not set', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- Typedef requires a value
    vi.stubEnv('GITHUB_HEAD_REF', undefined);
    vi.stubEnv('GITHUB_REF_NAME', '<GITHUB_REF_NAME>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).toHaveBeenCalledExactlyOnceWith('<GITHUB_REF_NAME>', expect.anything());
  });

  it('should use the GITHUB_HEAD_REF as the initialBranch when it is set', async () => {
    vi.stubEnv('GITHUB_HEAD_REF', '<GITHUB_HEAD_REF>');
    vi.stubEnv('GITHUB_REF_NAME', '<GITHUB_REF_NAME>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).toHaveBeenCalledExactlyOnceWith('<GITHUB_HEAD_REF>', expect.anything());
  });

  it('should set the correct actor email', async () => {
    vi.stubEnv('GITHUB_ACTOR_ID', '<GITHUB_ACTOR_ID>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = `<GITHUB_ACTOR_ID>+${gitHubMock.context.actor}@users.noreply.github.com`;
    expect(setUserSpy).toHaveBeenCalledExactlyOnceWith(expect.anything(), expected);
  });

  it('should set the correct actor name', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setUserSpy).toHaveBeenCalledExactlyOnceWith(gitHubMock.context.actor, expect.anything());
  });

  it('should use "v0.0.0" as the current version if there is no latest release found', async () => {
    getLatestReleaseSpy.mockRejectedValue(
      new RequestError('', 404, { request: { headers: {}, url: 'https://example.com' } } as any),
    );
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('current-version', '0.0.0');
  });

  it('should fail with an Error if the request to get the latest release fails', async () => {
    const error = new Error('<getLatestReleaseError>');
    getLatestReleaseSpy.mockRejectedValue(error);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setFailedSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('should fail with an Error if the tag name for the latest release is an invalid semver version', async () => {
    getLatestReleaseSpy.mockResolvedValue({ data: { tag_name: 'invalid-tag' } });
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = new Error('The tag name "invalid-tag" for the latest release is not a valid semver version');
    expect(setFailedSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should update the "latest" tag', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['latest']);
    expect(addTagsSpy).toHaveBeenCalledWith(expected);
  });

  it('should update the latest tag using the tag name provided by the "latest-tag-name" input', async () => {
    workflow.setInputValue('latest-tag-name', '<latestTagInput>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['<latestTagInput>']);
    expect(addTagsSpy).toHaveBeenCalledWith(expected);
  });

  it('should override the next version provided by the "version-override" input', async () => {
    workflow.setInputValue('version-override', '2.0.0');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('next-version', '2.0.0');
  });

  it('should set the correct increment-type when the "version-override" input is for a patch version', async () => {
    workflow.setInputValue('version-override', '1.0.1');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('increment-type', 'patch');
  });

  it('should set the correct increment-type when the "version-override" input is for a minor version', async () => {
    workflow.setInputValue('version-override', '1.1.0');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('increment-type', 'minor');
  });

  it('should set the correct increment-type when the "version-override" input is for a major version', async () => {
    workflow.setInputValue('version-override', '2.0.0');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('increment-type', 'major');
  });

  it('should set the increment type to "patch" when there is no git history', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('increment-type', 'patch');
  });

  it('should set the increment type to an empty string when the "version-override" input is the same as the current version', async () => {
    workflow.setInputValue('version-override', '1.0.0');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).toHaveBeenCalledWith('increment-type', '');
  });

  it('should return without setting any outputs when there is no git history', async () => {
    getHistorySpy.mockResolvedValue([]);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setOutputSpy).not.toHaveBeenCalled();
  });

  it('should set tag name from the "tracking-tag" input', async () => {
    workflow.setInputValue('tracking-tag', '<TrackingTag>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(addTagsSpy).toHaveBeenCalledWith(['<TrackingTag>']);
  });

  it('should switch to the release branch name provided by the "release-branch" input', async () => {
    workflow.setInputValue('release-branch', '<releaseBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(switchSpy).toHaveBeenCalledWith('<releaseBranch>', expect.anything());
  });

  it('should create the release branch if it does not exist', async () => {
    workflow.setInputValue('release-branch', '<releaseBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(switchSpy).toHaveBeenCalledWith('<releaseBranch>', { shouldCreate: true });
  });

  it('should not create the release branch if it exists', async () => {
    getBranchesSpy.mockResolvedValue({
      detached: false,
      current: 'current',
      all: [`remotes/origin/develop`, `remotes/origin/<releaseBranch>`],
      branches: {},
    });
    workflow.setInputValue('release-branch', '<releaseBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(switchSpy).toHaveBeenCalledWith('<releaseBranch>', { shouldCreate: false });
  });

  it('should not create a merge commit on the release branch if it does not exist', async () => {
    vi.stubEnv('GITHUB_HEAD_REF', '<initialBranch>');
    workflow.setInputValue('release-branch', '<releaseBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).not.toHaveBeenCalled();
  });

  it('should create a merge commit on the release branch if it already exists', async () => {
    vi.stubEnv('GITHUB_HEAD_REF', '<initialBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).toHaveBeenCalledExactlyOnceWith('<initialBranch>', expect.anything());
  });

  it('should set the correct commit message when creating a merge commit on the release branch', async () => {
    vi.stubEnv('GITHUB_HEAD_REF', '<initialBranch>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(mergeSpy).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'Release v1.0.1');
  });

  it('should execute the build command if one is provided via the "build-command" input', async () => {
    workflow.setInputValue('build-command', '<buildCommand>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(execMock).toHaveBeenCalledExactlyOnceWith('<buildCommand>', expect.anything(), expect.anything());
  });

  it('should not execute the build command if one is provided via the "build-command" input but the "dry-run" input is true', async () => {
    workflow.setInputValue('build-command', '<buildCommand>');
    workflow.setInputValue('dry-run', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('should not amend the commit if there are no changes after the build and the release branch exists', async () => {
    statusSpy.mockResolvedValue({ isClean: true } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(amendCommitWithAllFilesSpy).not.toHaveBeenCalled();
  });

  it('should not create a commit if there are no changes after the build and the release branch does not exist', async () => {
    workflow.setInputValue('release-branch', '<releaseBranch>');
    statusSpy.mockResolvedValue({ isClean: true } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(commitAllFilesSpy).not.toHaveBeenCalled();
  });

  it('should amend the commit if there are changes after the build and the release branch exists', async () => {
    statusSpy.mockResolvedValue({ isClean: false } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(amendCommitWithAllFilesSpy).toHaveBeenCalled();
  });

  it('should create a commit if there no changes after the build and the release branch does not exist', async () => {
    workflow.setInputValue('release-branch', '<releaseBranch>');
    statusSpy.mockResolvedValue({ isClean: false } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(commitAllFilesSpy).toHaveBeenCalled();
  });

  it('should set the correct commit message if there no changes after the build and the release branch does not exist', async () => {
    workflow.setInputValue('release-branch', '<releaseBranch>');
    statusSpy.mockResolvedValue({ isClean: false } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(commitAllFilesSpy).toHaveBeenCalledExactlyOnceWith('Release v1.0.1');
  });

  it('should update the version tags for the major, major with minor, and major with minor and patch versions', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['v1', 'v1.0', 'v1.0.1']);

    expect(addTagsSpy).toHaveBeenCalledWith(expected);
  });

  it('should not update the version tags when the "dry-run" input is true', async () => {
    workflow.setInputValue('dry-run', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['v1', 'v1.0', 'v1.0.1']);
    expect(addTagsSpy).not.toHaveBeenCalledWith(expected);
  });

  it('should not update the version tags when the "disable-git-tagging" input is true', async () => {
    workflow.setInputValue('disable-git-tagging', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['v1', 'v1.0', 'v1.0.1']);
    expect(addTagsSpy).not.toHaveBeenCalledWith(expected);
  });

  it('should push the commit on the release branch to the remote', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(pushToRemoteSpy).toHaveBeenCalledExactlyOnceWith({ remote: 'origin', branch: 'release' });
  });
  it('should not push the commit on the release branch to the remote when the "dry-run" input is true', async () => {
    workflow.setInputValue('dry-run', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(pushToRemoteSpy).not.toHaveBeenCalled();
  });

  it('should push the tags to the remote', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(pushTagsSpy).toHaveBeenCalled();
  });

  it('should not push tags to the remote when the "dry-run" input is true', async () => {
    workflow.setInputValue('dry-run', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(pushTagsSpy).not.toHaveBeenCalled();
  });

  it('should switch back to the initial branch', async () => {
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(switchSpy).toHaveBeenCalledWith('-');
  });

  it('should use the default changelog titles when the "changelog-titles" input is empty', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.clearInputValue('changelog-titles');
    getHistorySpy.mockResolvedValue([makeGitHistory({ message: 'feat!: <majorFeatureSummary>' })]);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ body: expect.stringContaining('BREAKING CHANGES') });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should use the changelog titles provided by the "changelog-titles" input', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('changelog-titles', '{ "feat": "<featureTitle>" }');
    getHistorySpy.mockResolvedValue([makeGitHistory({ message: 'feat: <featureSummary>' })]);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ body: expect.stringContaining('<featureTitle>') });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should use the values provided by the "major-types" input when grouping entries for the changelog', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('major-types', 'example');
    getHistorySpy.mockResolvedValue([makeGitHistory({ message: 'example: <summary>' })]);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ body: expect.stringContaining('BREAKING CHANGES') });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should append the value from the "git-tag-suffix" input to the git tags', async () => {
    workflow.setInputValue('git-tag-suffix', '<suffix>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.arrayContaining(['v1<suffix>', 'v1.0<suffix>', 'v1.0.1<suffix>']);
    expect(addTagsSpy).toHaveBeenCalledWith(expected);
  });

  it('should use the release title provided by the "release-title" input', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('release-title', '<overrideReleaseTitle>');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ name: '<overrideReleaseTitle>' });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should set the tag_name for the GitHub release to the new version tag', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ tag_name: 'v1.0.1' });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should not submit a GitHub release when the input "disable-github-release" is true', async () => {
    workflow.setInputValue('disable-github-release', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(createReleaseSpy).not.toHaveBeenCalled();
  });

  it('should not submit a GitHub release when the input "dry-run" is true', async () => {
    workflow.setInputValue('dry-run', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(createReleaseSpy).not.toHaveBeenCalled();
  });

  it('should get the release title from the PR when the "get-release-title-from-pr" input is set to true', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('get-release-title-from-pr', 'true');
    listPullRequestsAssociatedWithCommitSpy.mockResolvedValue({ status: 200, data: [{ title: '<prTitle>' }] });
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ name: '<prTitle>' });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should fail when the "get-release-title-from-pr" input is set to true and there is an error when querying GitHub for the PR title', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('get-release-title-from-pr', 'true');
    const error = new Error('Failed to get PRs associated with commit');
    listPullRequestsAssociatedWithCommitSpy.mockRejectedValue(error);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(setFailedSpy).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('should fallback to the version tag release title when the "get-release-title-from-pr" input is set to true and there are no PR details found', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('get-release-title-from-pr', 'true');
    listPullRequestsAssociatedWithCommitSpy.mockResolvedValue({ status: 200, data: [] });
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ name: 'v1.0.1' });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should prepend the version to the release title when the "get-release-title-from-pr" and "prepend-version-to-release-title" inputs are both set to true', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('get-release-title-from-pr', 'true');
    workflow.setInputValue('prepend-version-to-release-title', 'true');
    listPullRequestsAssociatedWithCommitSpy.mockResolvedValue({ status: 200, data: [{ title: '<prTitle>' }] });
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ name: 'v1.0.1 - <prTitle>' });
    expect(createReleaseSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should pass the correct repo info and commit sha to the GitHub request for listing associated pull requests', async () => {
    workflow.setInputValue('enable-github-release', 'true');
    workflow.setInputValue('get-release-title-from-pr', 'true');
    workflow.setInputValue('prepend-version-to-release-title', 'true');
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    const expected = expect.objectContaining({ ...gitHubMock.context.repo, commit_sha: gitHubMock.context.sha });
    expect(listPullRequestsAssociatedWithCommitSpy).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('should log a warning when there is a build command provided and there are no changes detected', async () => {
    workflow.setInputValue('build-command', '<buildCommand>');
    vi.spyOn(git, 'status').mockResolvedValue({ isClean: true } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(loggerMock.warning).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('No changes'));
  });

  it('should not log a warning when there is a build command provided and there are changes detected', async () => {
    workflow.setInputValue('build-command', '<buildCommand>');
    vi.spyOn(git, 'status').mockResolvedValue({ isClean: false } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(loggerMock.warning).not.toHaveBeenCalled();
  });

  it('should not log a warning when there is no build command provided and there are no changes detected', async () => {
    workflow.clearInputValue('build-command');
    vi.spyOn(git, 'status').mockResolvedValue({ isClean: true } as any);
    await run(loggerMock, workflow, gitHubMock, git, execMock);
    expect(loggerMock.warning).not.toHaveBeenCalled();
  });
});
