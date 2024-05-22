import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';
import { RequestError } from '@octokit/request-error';
import { getInputs } from './core/getInputs.js';
import semver, { ReleaseType, SemVer } from 'semver';
import { Git } from './io/git.js';
import { getIncrementType } from './core/getIncrementType.js';
import { buildChangelog } from './core/buildChangelog.js';

const NOT_FOUND = 404;
const JSON_INDENT = 2;

export async function run() {
  try {
    /* Initialization */
    const cwd = process.env.GITHUB_WORKSPACE;
    if (!cwd) {
      throw new Error(
        'Unable to retrieve the current working directory using environment variable "GITHUB_WORKSPACE".',
      );
    }
    const inputs = getInputs();
    const git = new Git();
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const initialBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || github.context.ref;
    const actorEmail = `${process.env.GITHUB_ACTOR_ID}+${github.context.actor}@users.noreply.github.com`;
    const remote = 'origin';

    /* Get the version details */
    const octokit = github.getOctokit(inputs.githubToken);
    let tagName = 'v0.0.0';
    let currentVersion: SemVer | null = null;
    let nextVersion: SemVer | null | undefined = inputs.versionOverride;
    let incrementType: ReleaseType | null = null;

    try {
      const latestRelease = (await octokit.rest.repos.getLatestRelease(github.context.repo)).data;
      tagName = latestRelease.tag_name;
      currentVersion = semver.parse(tagName);
    } catch (e) {
      if (e instanceof RequestError && e.status === NOT_FOUND) {
        core.warning(`No releases found in the repo, using "${tagName}" as the current version`);
        currentVersion = semver.parse(tagName);
      }
    }

    if (!currentVersion) {
      throw new Error(`The tag name "${tagName}" for the latest release is not a valid semver version`);
    }

    const gitHistory = await git.getHistory(inputs.trackingTag, github.context.sha);
    core.debug(`Using git history: ${JSON.stringify(gitHistory, undefined, JSON_INDENT)}`);

    if (nextVersion) {
      incrementType = semver.diff(currentVersion, nextVersion);
    } else {
      if (!gitHistory.length) {
        core.info('GitHub SHA matches latest release, exiting.');
        return;
      }

      incrementType = getIncrementType(gitHistory, inputs.majorTypes, inputs.minorTypes);

      nextVersion = semver.parse(currentVersion.version)?.inc(incrementType);
      if (!nextVersion) {
        throw new Error(`The current version "${currentVersion}" is not a valid semver value.`);
      }
    }

    core.info(`Current package version: ${currentVersion}`);
    core.info(`Increment Type: ${incrementType ?? 'N/A'}`);
    core.info(`Next package version: ${nextVersion}`);

    /* Create the new Release commit */
    const newTag = `v${nextVersion.version}${inputs.gitTagSuffix}`;
    const newTagMinor = `v${nextVersion.major}.${nextVersion.minor}${inputs.gitTagSuffix}`;
    const newTagMajor = `v${nextVersion.major}${inputs.gitTagSuffix}`;

    core.debug(`Setting the tracking tag "${inputs.trackingTag}" on the source branch "${initialBranch}".`);
    await git.addTags([inputs.trackingTag]);

    core.debug(`Switching to the release branch "${inputs.releaseBranch}".`);
    const releaseBranchExists = (await git.getBranches()).all.includes(`remotes/${remote}/${inputs.releaseBranch}`);
    await git.switch(inputs.releaseBranch, { create: !releaseBranchExists });

    core.debug(`Setting git user details: ${JSON.stringify({ actor: github.context.actor, actorEmail })}`);
    await git.setUser(github.context.actor, actorEmail);

    if (releaseBranchExists) {
      core.debug(`Creating a merge commit on the release branch "${inputs.releaseBranch}".`);
      await git.merge(initialBranch, `Release ${newTag}`);
    }

    if (inputs.buildCommand) {
      if (inputs.dryRun) {
        core.info(`DRY RUN: Running build command "${inputs.buildCommand}".`);
      } else {
        await exec(inputs.buildCommand, [], { cwd });
      }
    }

    const status = await git.status();
    core.debug(`Git status after build: ${JSON.stringify(status, undefined, JSON_INDENT)}`);

    if (status.isClean) {
      core.warning('No changes detected after build.');
    } else {
      core.debug('Creating a new commit with the changes from the build.');
      if (releaseBranchExists) {
        await git.amendCommitWithAllFiles();
      } else {
        await git.commitAllFiles(`Release ${newTag}`);
      }
    }

    /* Push the git changes */
    const releaseTags = ['latest', newTag, newTagMinor, newTagMajor];
    if (inputs.dryRun) {
      core.info(`DRY RUN: Push the new commit to ${JSON.stringify({ remote, branch: inputs.releaseBranch })}`);
      if (inputs.enableGitTagging) {
        core.info(`DRY RUN: Git tags to be added/updated: ${JSON.stringify(releaseTags)}`);
      }
      core.info(`DRY RUN: Pushing tags to "${remote}".`);
    } else {
      core.debug(`Push the new commit to ${JSON.stringify({ remote, branch: inputs.releaseBranch })}`);
      await git.pushToRemote({ remote, branch: inputs.releaseBranch });

      if (inputs.enableGitTagging) {
        core.debug(`Setting the git tags on the new commit "${JSON.stringify(releaseTags)}".`);
        await git.addTags(releaseTags);
      }

      // Push tags even when git tagging is disabled to always push the src tracking tag
      await git.pushTags();
    }

    core.debug('Switch back to the initial branch.');
    await git.switch('-');

    /* Create release notes and GitHub Release */
    core.info('Creating GitHub Release');
    await octokit.rest.repos.createRelease({
      ...github.context.repo,
      tag_name: newTag,
      name: newTag,
      body: buildChangelog(gitHistory, inputs.changelogTitles, inputs.majorTypes),
      prerelease: false,
      draft: false,
    });

    /* Set the action outputs */
    core.setOutput('current-version', currentVersion.version);
    core.setOutput('increment-type', incrementType ?? '');
    core.setOutput('next-version', nextVersion.version);
    core.setOutput('next-version-major', nextVersion.major);
    core.setOutput('next-version-minor', nextVersion.minor);
    core.setOutput('next-version-patch', nextVersion.patch);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    core.setFailed(message);
  }
}
