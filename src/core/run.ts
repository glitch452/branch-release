import { type exec as ActionsExec } from '@actions/exec';
import { RequestError } from '@octokit/request-error';
import semver, { ReleaseType, SemVer } from 'semver';
import { buildChangelog } from './buildChangelog.js';
import { getIncrementType } from './getIncrementType.js';
import { getInputs } from './getInputs.js';
import { GitService } from 'src/services/GitService.js';
import { GitHub } from 'src/types/GitHub.js';
import { Logger } from 'src/types/Logger.js';
import { Workflow } from 'src/types/Workflow.js';

const NOT_FOUND = 404;
const JSON_INDENT = 2;

export async function run(
  logger: Logger,
  workflow: Workflow,
  github: GitHub,
  git: GitService,
  exec: typeof ActionsExec,
) {
  try {
    /* Initialization */
    const cwd = process.env.GITHUB_WORKSPACE;
    if (!cwd) {
      throw new Error(
        'Unable to retrieve the current working directory using environment variable "GITHUB_WORKSPACE".',
      );
    }
    const inputs = getInputs(workflow);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const initialBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || github.context.ref;
    const actorEmail = `${process.env.GITHUB_ACTOR_ID}+${github.context.actor}@users.noreply.github.com`;
    const remote = 'origin';

    /* Get the version details */
    const octokit = github.getOctokit(inputs.githubToken);
    let tagName = 'v0.0.0';
    let currentVersion: SemVer | null | undefined;
    let nextVersion: SemVer | null | undefined = inputs.versionOverride;
    let incrementType: ReleaseType | null | undefined;

    try {
      const latestRelease = (await octokit.rest.repos.getLatestRelease(github.context.repo)).data;
      tagName = latestRelease.tag_name;
      currentVersion = semver.parse(tagName);
    } catch (error) {
      if (error instanceof RequestError && error.status === NOT_FOUND) {
        logger.warning(`No releases found in the repo, using "${tagName}" as the current version`);
        currentVersion = semver.parse(tagName);
      } else {
        throw error;
      }
    }

    if (!currentVersion) {
      throw new Error(`The tag name "${tagName}" for the latest release is not a valid semver version`);
    }

    const gitHistory = await git.getHistory(inputs.trackingTag, github.context.sha);
    logger.debug(`Using git history: ${JSON.stringify(gitHistory, undefined, JSON_INDENT)}`);

    if (nextVersion) {
      incrementType = semver.diff(currentVersion, nextVersion);
    } else {
      if (!gitHistory.length) {
        logger.info('GitHub SHA matches latest release, exiting.');
        return;
      }

      incrementType = getIncrementType(gitHistory, inputs.majorTypes, inputs.minorTypes);

      nextVersion = semver.parse(currentVersion.version)?.inc(incrementType);
      if (!nextVersion) {
        throw new Error(`The current version "${currentVersion.toString()}" is not a valid semver value.`);
      }
    }

    logger.info(`Current package version: ${currentVersion.toString()}`);
    logger.info(`Increment Type: ${incrementType ?? 'N/A'}`);
    logger.info(`Next package version: ${nextVersion.toString()}`);

    /* Create the new Release commit */
    const newTag = `v${nextVersion.version}${inputs.gitTagSuffix}`;
    const newTagMinor = `v${nextVersion.major}.${nextVersion.minor}${inputs.gitTagSuffix}`;
    const newTagMajor = `v${nextVersion.major}${inputs.gitTagSuffix}`;

    logger.debug(`Setting the tracking tag "${inputs.trackingTag}" on the source branch "${initialBranch}".`);
    await git.addTags([inputs.trackingTag]);

    logger.debug(`Switching to the release branch "${inputs.releaseBranch}".`);
    const releaseBranchExists = (await git.getBranches()).all.includes(`remotes/${remote}/${inputs.releaseBranch}`);
    await git.switch(inputs.releaseBranch, { create: !releaseBranchExists });

    logger.debug(`Setting git user details: ${JSON.stringify({ actor: github.context.actor, actorEmail })}`);
    await git.setUser(github.context.actor, actorEmail);

    if (releaseBranchExists) {
      logger.debug(`Creating a merge commit on the release branch "${inputs.releaseBranch}".`);
      await git.merge(initialBranch, `Release ${newTag}`);
    }

    if (inputs.buildCommand) {
      if (inputs.dryRun) {
        logger.info(`DRY RUN: Running build command "${inputs.buildCommand}".`);
      } else {
        await exec(inputs.buildCommand, [], { cwd });
      }
    }

    const status = await git.status();
    logger.debug(`Git status after build: ${JSON.stringify(status, undefined, JSON_INDENT)}`);

    if (status.isClean) {
      logger.warning('No changes detected after build.');
    } else {
      logger.debug('Creating a new commit with the changes from the build.');
      await (releaseBranchExists ? git.amendCommitWithAllFiles() : git.commitAllFiles(`Release ${newTag}`));
    }

    /* Push the git changes */
    const releaseTags = [inputs.latestTagName, newTag, newTagMinor, newTagMajor];
    if (inputs.dryRun) {
      logger.info(`DRY RUN: Push the new commit to ${JSON.stringify({ remote, branch: inputs.releaseBranch })}`);
      if (inputs.enableGitTagging) {
        logger.info(`DRY RUN: Git tags to be added/updated: ${JSON.stringify(releaseTags)}`);
      }
      logger.info(`DRY RUN: Pushing tags to "${remote}".`);
    } else {
      logger.debug(`Push the new commit to ${JSON.stringify({ remote, branch: inputs.releaseBranch })}`);
      await git.pushToRemote({ remote, branch: inputs.releaseBranch });

      if (inputs.enableGitTagging) {
        logger.debug(`Setting the git tags on the new commit "${JSON.stringify(releaseTags)}".`);
        await git.addTags(releaseTags);
      }

      // Push tags even when git tagging is disabled to always push the src tracking tag
      await git.pushTags();
    }

    logger.debug('Switch back to the initial branch.');
    await git.switch('-');

    /* Create release notes and GitHub Release */
    if (inputs.enableGithubRelease) {
      logger.info('Creating GitHub Release');

      const getReleaseTitle = async (): Promise<string> => {
        if (inputs.releaseTitle) {
          return inputs.releaseTitle;
        }
        if (inputs.getReleaseTitleFromPr) {
          const response = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
            ...github.context.repo,
            commit_sha: github.context.sha,
          });
          const releaseTitle = response.data[0]?.title;
          if (!releaseTitle) {
            return newTag;
          }
          return inputs.prependVersionToReleaseTitle ? `${newTag} - ${releaseTitle}` : releaseTitle;
        }
        return newTag;
      };

      const releaseDetails = {
        ...github.context.repo,
        tag_name: newTag,
        name: await getReleaseTitle(),
        body: buildChangelog(gitHistory, github.context.repo, inputs.changelogTitles, inputs.majorTypes),
        prerelease: false,
        draft: false,
      };

      logger.debug(`GitHub Release Details: ${JSON.stringify(releaseDetails)}`);
      await octokit.rest.repos.createRelease(releaseDetails);
    }

    /* Set the action outputs */
    workflow.setOutput('current-version', currentVersion.version);
    workflow.setOutput('increment-type', incrementType ?? '');
    workflow.setOutput('next-version', nextVersion.version);
    workflow.setOutput('next-version-major', nextVersion.major);
    workflow.setOutput('next-version-minor', nextVersion.minor);
    workflow.setOutput('next-version-patch', nextVersion.patch);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    workflow.setFailed(message);
  }
}
