import semver from 'semver';
import { z } from 'zod';
import { DEFAULT_TYPE_TITLES } from './constants.js';
import { Workflow } from 'src/types/Workflow.js';

export function getInputs(getters: Pick<Workflow, 'getBooleanInput' | 'getInput' | 'getMultilineInput'>) {
  const originals = {
    changelogTitles: getters.getInput('changelog-titles'),
    versionOverride: getters.getInput('version-override'),
  };

  const versionOverride = originals.versionOverride ? semver.parse(originals.versionOverride) : undefined;
  if (originals.versionOverride && !versionOverride) {
    throw new Error(`The version override "${originals.versionOverride}" is not a valid semver string.`);
  }

  const changelogTitles = z.record(z.string(), z.string()).parse(JSON.parse(originals.changelogTitles || '{}'));

  const inputs = {
    buildCommand: getters.getInput('build-command'),
    changelogTitles: { ...DEFAULT_TYPE_TITLES, ...changelogTitles },
    dryRun: getters.getBooleanInput('dry-run'),
    enableGithubRelease: !getters.getBooleanInput('disable-github-release'),
    enableGitTagging: !getters.getBooleanInput('disable-git-tagging'),
    getReleaseTitleFromPr: getters.getBooleanInput('get-release-title-from-pr'),
    githubToken: getters.getInput('github-token', { required: true }),
    gitTagSuffix: getters.getInput('git-tag-suffix'),
    latestTagName: getters.getInput('latest-tag-name') || 'latest',
    majorTypes: getters.getInput('major-types').split(',').filter(Boolean),
    minorTypes: (getters.getInput('minor-types') || 'feat').split(',').filter(Boolean),
    prependVersionToReleaseTitle: getters.getBooleanInput('prepend-version-to-release-title'),
    releaseBranch: getters.getInput('release-branch') || 'release',
    releaseTitle: getters.getInput('release-title'),
    trackingTag: getters.getInput('tracking-tag') || 'latest-src',
    versionOverride,
  } as const;

  return inputs;
}
