import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { DEFAULT_TYPE_TITLES } from './constants.js';
import { getInputs } from './getInputs.js';
import { WorkflowMock } from '__mocks__/WorkflowMock.js';

describe(getInputs.name, () => {
  const workflowMock = new WorkflowMock();

  beforeEach(() => {
    workflowMock.reset(true);
  });

  describe('action.yaml', () => {
    const actionFilePath = path.join(import.meta.dirname, '..', '..', 'action.yml');
    const actionFile = yaml.parse(fs.readFileSync(actionFilePath).toString());

    it('Should contain exactly the inputs that are requested in the action', () => {
      getInputs(workflowMock);

      const actual = Object.keys(actionFile.inputs).sort();
      const expected = [...workflowMock.requestedInputs].sort();
      expect(actual).toStrictEqual(expected);
    });

    const requiredInputNames = Object.entries<any>(actionFile.inputs)
      .filter(([, { required }]) => required)
      .map(([x]) => x);

    it.each(requiredInputNames)('Should throw an error if the required field "%s" is not provided', (inputName) => {
      // This ensures that all inputs marked 'required' in the yaml file also have the required flag set on the input options
      workflowMock.clearInputValue(inputName);
      const actual = () => getInputs(workflowMock);
      expect(actual).toThrow(`Value Required for ${inputName}`);
    });
  });

  describe('buildCommand', () => {
    it('Should return the provided "build-command"', () => {
      workflowMock.setInputValue('build-command', '<buildCommand>');
      const actual = getInputs(workflowMock).buildCommand;
      expect(actual).toBe('<buildCommand>');
    });
  });

  describe('changelogTitles', () => {
    it('Should return the defaults for "changelog-titles" if a value is not provided', () => {
      workflowMock.clearInputValue('changelog-titles');
      const actual = getInputs(workflowMock).changelogTitles;
      expect(actual).toStrictEqual(DEFAULT_TYPE_TITLES);
    });

    it('Should return the appended value for "changelog-titles" if it is set to a valid value', () => {
      workflowMock.setInputValue('changelog-titles', '{ "feat": "Awesome Features!" }');
      const actual = getInputs(workflowMock).changelogTitles;
      const expected = { ...DEFAULT_TYPE_TITLES, feat: 'Awesome Features!' };
      expect(actual).toStrictEqual(expected);
    });

    it('Should throw an error if the value is not valid json', () => {
      workflowMock.setInputValue('changelog-titles', 'feat = Awesome Features!');
      const actual = () => getInputs(workflowMock).changelogTitles;
      expect(actual).toThrow();
    });

    it('Should throw an error if the value is valid json but does not conform to the schema', () => {
      workflowMock.setInputValue('changelog-titles', '{ "feat": [ "Awesome Features!" ] }');
      const actual = () => getInputs(workflowMock).changelogTitles;
      expect(actual).toThrow();
    });
  });

  describe('enableGithubRelease', () => {
    it('should return false for enableGithubRelease when "disable-github-release" is true', () => {
      workflowMock.setInputValue('disable-github-release', 'true');
      const actual = getInputs(workflowMock).enableGithubRelease;
      expect(actual).toBe(false);
    });

    it('should return true for enableGithubRelease when "disable-github-release" is false', () => {
      workflowMock.setInputValue('disable-github-release', 'false');
      const actual = getInputs(workflowMock).enableGithubRelease;
      expect(actual).toBe(true);
    });

    it('should return true for enableGithubRelease when "disable-github-release" is not provided', () => {
      workflowMock.clearInputValue('disable-github-release');
      const actual = getInputs(workflowMock).enableGithubRelease;
      expect(actual).toBe(true);
    });
  });

  describe('dryRun', () => {
    it('Should return false for "dry-run" if a value is not provided', () => {
      workflowMock.clearInputValue('dry-run');
      const actual = getInputs(workflowMock).dryRun;
      expect(actual).toBe(false);
    });

    it('Should return true for "dry-run" if it is set to a true value', () => {
      workflowMock.setInputValue('dry-run', 'true');
      const actual = getInputs(workflowMock).dryRun;
      expect(actual).toBe(true);
    });
  });

  describe('enableGitTagging', () => {
    it('Should return false for enableGitTagging when "disable-git-tagging" is true', () => {
      workflowMock.setInputValue('disable-git-tagging', 'true');
      const actual = getInputs(workflowMock).enableGitTagging;
      expect(actual).toBe(false);
    });

    it('Should return true for enableGitTagging when "disable-git-tagging" is false', () => {
      workflowMock.setInputValue('disable-git-tagging', 'false');
      const actual = getInputs(workflowMock).enableGitTagging;
      expect(actual).toBe(true);
    });

    it('Should return true for enableGitTagging when "disable-git-tagging" is not provided', () => {
      workflowMock.clearInputValue('disable-git-tagging');
      const actual = getInputs(workflowMock).enableGitTagging;
      expect(actual).toBe(true);
    });
  });

  describe('getReleaseTitleFromPr', () => {
    it('Should return false for "get-release-title-from-pr" if a value is not provided', () => {
      workflowMock.clearInputValue('get-release-title-from-pr');
      const actual = getInputs(workflowMock).getReleaseTitleFromPr;
      expect(actual).toBe(false);
    });

    it('Should return true for "get-release-title-from-pr" if it is set to a true value', () => {
      workflowMock.setInputValue('get-release-title-from-pr', 'true');
      const actual = getInputs(workflowMock).getReleaseTitleFromPr;
      expect(actual).toBe(true);
    });
  });

  describe('githubToken', () => {
    it('Should throw an error if "disable-git-tagging" is false and the "github-token" is not provided', () => {
      workflowMock.setInputValue('disable-git-tagging', 'false');
      workflowMock.clearInputValue('github-token');
      const actual = () => getInputs(workflowMock);
      expect(actual).toThrow('github-token');
    });

    it('Should return the provided "github-token"', () => {
      workflowMock.setInputValue('github-token', '<githubToken>');
      const actual = getInputs(workflowMock).githubToken;
      expect(actual).toBe('<githubToken>');
    });
  });

  describe('gitTagSuffix', () => {
    it('Should return the provided "git-tag-suffix"', () => {
      workflowMock.setInputValue('git-tag-suffix', '<gitTagSuffix>');
      const actual = getInputs(workflowMock).gitTagSuffix;
      expect(actual).toBe('<gitTagSuffix>');
    });
  });

  describe('latestTagName', () => {
    it('Should return the default "latest-tag-name" if it is not provided', () => {
      workflowMock.clearInputValue('latest-tag-name');
      const actual = getInputs(workflowMock).latestTagName;
      expect(actual).toBe('latest');
    });

    it('Should return the provided "latest-tag-name"', () => {
      workflowMock.setInputValue('latest-tag-name', '<latestTagName>');
      const actual = getInputs(workflowMock).latestTagName;
      expect(actual).toBe('<latestTagName>');
    });
  });

  describe('majorTypes', () => {
    it('Should return an empty list of no major types are provided', () => {
      workflowMock.clearInputValue('major-types');
      const actual = getInputs(workflowMock).majorTypes;
      expect(actual).toStrictEqual([]);
    });

    it('Should return the provided "major-types"', () => {
      workflowMock.setInputValue('major-types', '<major1>,<major2>');
      const actual = getInputs(workflowMock).majorTypes;
      expect(actual).toStrictEqual(['<major1>', '<major2>']);
    });
  });

  describe('minorTypes', () => {
    it('Should return the default "minor-types" if it is not provided', () => {
      workflowMock.clearInputValue('minor-types');
      const actual = getInputs(workflowMock).minorTypes;
      expect(actual).toStrictEqual(['feat']);
    });

    it('Should return the provided "minor-types"', () => {
      workflowMock.setInputValue('minor-types', '<minor1>,<minor2>');
      const actual = getInputs(workflowMock).minorTypes;
      expect(actual).toStrictEqual(['<minor1>', '<minor2>']);
    });
  });

  describe('prependVersionToReleaseTitle', () => {
    it('should return false for "prepend-version-to-release-title" if a value is not provided', () => {
      workflowMock.clearInputValue('prepend-version-to-release-title');
      const actual = getInputs(workflowMock).prependVersionToReleaseTitle;
      expect(actual).toBe(false);
    });

    it('should return true for "prepend-version-to-release-title" if it is set to a true value', () => {
      workflowMock.setInputValue('prepend-version-to-release-title', 'true');
      const actual = getInputs(workflowMock).prependVersionToReleaseTitle;
      expect(actual).toBe(true);
    });
  });

  describe('releaseBranch', () => {
    it('Should return the default "release-branch" if it is not provided', () => {
      workflowMock.clearInputValue('release-branch');
      const actual = getInputs(workflowMock).releaseBranch;
      expect(actual).toBe('release');
    });

    it('Should return the provided "release-branch"', () => {
      workflowMock.setInputValue('release-branch', '<releaseBranch>');
      const actual = getInputs(workflowMock).releaseBranch;
      expect(actual).toBe('<releaseBranch>');
    });
  });

  describe('releaseTitle', () => {
    it('Should return an empty string if a value is not provided', () => {
      const actual = getInputs(workflowMock).releaseTitle;
      expect(actual).toBe('');
    });

    it('Should return the provided "release-title"', () => {
      workflowMock.setInputValue('release-title', '<releaseTitle>');
      const actual = getInputs(workflowMock).releaseTitle;
      expect(actual).toBe('<releaseTitle>');
    });
  });

  describe('trackingTag', () => {
    it('Should return the default "tracking-tag" if it is not provided', () => {
      workflowMock.clearInputValue('tracking-tag');
      const actual = getInputs(workflowMock).trackingTag;
      expect(actual).toBe('latest-src');
    });

    it('Should return the provided "tracking-tag"', () => {
      workflowMock.setInputValue('tracking-tag', '<trackingTag>');
      const actual = getInputs(workflowMock).trackingTag;
      expect(actual).toBe('<trackingTag>');
    });
  });

  describe('versionOverride', () => {
    it('Should return null if no "version-override" is provided', () => {
      workflowMock.clearInputValue('version-override');
      const actual = getInputs(workflowMock).versionOverride;
      expect(actual).toBeUndefined();
    });

    it('Should return the provided "version-override"', () => {
      workflowMock.setInputValue('version-override', '0.1.2');
      const actual = getInputs(workflowMock).versionOverride?.version;
      expect(actual).toBe('0.1.2');
    });

    it('Should throw an error if the "version-override" is not a valid semver value', () => {
      workflowMock.setInputValue('version-override', '<version-override>');
      const actual = () => getInputs(workflowMock).versionOverride;
      expect(actual).toThrow('valid semver');
    });
  });
});
