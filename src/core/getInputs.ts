import * as core from '@actions/core';
import semver from 'semver';
import { z } from 'zod';
import { DEFAULT_TYPE_TITLES } from './constants.js';

export type Getters = Pick<typeof core, 'getBooleanInput' | 'getInput' | 'getMultilineInput'>;
export type InputOptions = core.InputOptions;

export function getInputs(getters: Getters = core) {
  const originals = {
    changelogTitles: getters.getInput('changelog-titles'),
    versionOverride: getters.getInput('version-override'),
  };

  const versionOverride = originals.versionOverride ? semver.parse(originals.versionOverride) : null;
  if (originals.versionOverride && !versionOverride) {
    throw new Error(`The version override "${originals.versionOverride}" is not a valid semver string.`);
  }

  const changelogTitles = z.record(z.string()).parse(JSON.parse(originals.changelogTitles || '{}'));

  const inputs = {
    buildCommand: getters.getInput('build-command'),
    changelogTitles: { ...DEFAULT_TYPE_TITLES, ...changelogTitles },
    dryRun: getters.getBooleanInput('dry-run'),
    enableGitTagging: !getters.getBooleanInput('disable-git-tagging'),
    githubToken: getters.getInput('github-token', { required: true }),
    gitTagSuffix: getters.getInput('git-tag-suffix'),
    majorTypes: getters.getInput('major-types').split(',').filter(Boolean),
    minorTypes: (getters.getInput('minor-types') || 'feat').split(',').filter(Boolean),
    releaseBranch: getters.getInput('release-branch') || 'release',
    trackingTag: getters.getInput('tracking-tag') || 'latest-src',
    versionOverride,
  } as const;

  return inputs;
}
