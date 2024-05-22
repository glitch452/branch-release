import { DEFAULT_TYPE_TITLES } from './constants.js';
import { Getters, InputOptions, getInputs } from './getInputs.js';

describe(getInputs.name, () => {
  let lookup: Record<string, string>;

  const getters: Getters = {
    getInput(name: string, options?: InputOptions) {
      const value = lookup[name] ?? '';
      if (options?.required && !value) {
        throw new Error(`Value Required for ${name}`);
      }
      return value;
    },
    getBooleanInput(name: string, options?: InputOptions) {
      return ['true', 'True', 'TRUE'].includes(this.getInput(name, options));
    },
    getMultilineInput(name: string, options?: InputOptions) {
      return this.getInput(name, options).split(/\r?\n/);
    },
  };

  beforeEach(() => {
    lookup = { 'registry-token': '<registryToken>', 'github-token': '<githubToken>' };
  });

  describe('buildCommand', () => {
    it('Should return the provided "build-command"', () => {
      lookup['build-command'] = '<buildCommand>';
      const actual = getInputs(getters).buildCommand;
      expect(actual).toStrictEqual('<buildCommand>');
    });
  });

  describe('changelog-titles', () => {
    it('Should return the defaults for "changelog-titles" if a value is not provided', () => {
      lookup['changelog-titles'] = '';
      const actual = getInputs(getters).changelogTitles;
      expect(actual).toStrictEqual(DEFAULT_TYPE_TITLES);
    });

    it('Should return the appended value for "changelog-titles" if it is set to a valid value', () => {
      lookup['changelog-titles'] = '{ "feat": "Awesome Features!" }';
      const actual = getInputs(getters).changelogTitles;
      const expected = { ...DEFAULT_TYPE_TITLES, feat: 'Awesome Features!' };
      expect(actual).toStrictEqual(expected);
    });

    it('Should throw an error if the value is not valid json', () => {
      lookup['changelog-titles'] = 'feat = Awesome Features!';
      const actual = () => getInputs(getters).changelogTitles;
      expect(actual).toThrow();
    });

    it('Should throw an error if the value is valid json but does not conform to the schema', () => {
      lookup['changelog-titles'] = '{ "feat": [ "Awesome Features!" ] }';
      const actual = () => getInputs(getters).changelogTitles;
      expect(actual).toThrow();
    });
  });

  describe('dry-run', () => {
    it('Should return false for "dry-run" if a value is not provided', () => {
      lookup['dry-run'] = '';
      const actual = getInputs(getters).dryRun;
      expect(actual).toStrictEqual(false);
    });

    it('Should return true for "dry-run" if it is set to a true value', () => {
      lookup['dry-run'] = 'true';
      const actual = getInputs(getters).dryRun;
      expect(actual).toStrictEqual(true);
    });
  });

  describe('enableGitTagging', () => {
    it('Should return false for enableGitTagging when "disable-git-tagging" is true', () => {
      lookup['disable-git-tagging'] = 'true';
      const actual = getInputs(getters).enableGitTagging;
      expect(actual).toStrictEqual(false);
    });

    it('Should return true for enableGitTagging when "disable-git-tagging" is false', () => {
      lookup['disable-git-tagging'] = 'false';
      const actual = getInputs(getters).enableGitTagging;
      expect(actual).toStrictEqual(true);
    });

    it('Should return true for enableGitTagging when "disable-git-tagging" is not provided', () => {
      lookup['disable-git-tagging'] = '';
      const actual = getInputs(getters).enableGitTagging;
      expect(actual).toStrictEqual(true);
    });
  });

  describe('githubToken', () => {
    it('Should throw an error if "disable-git-tagging" is false and the "github-token" is not provided', () => {
      lookup['disable-git-tagging'] = 'false';
      lookup['github-token'] = '';
      const actual = () => getInputs(getters);
      expect(actual).toThrow('github-token');
    });

    it('Should return the provided "github-token"', () => {
      lookup['github-token'] = '<githubToken>';
      const actual = getInputs(getters).githubToken;
      expect(actual).toStrictEqual('<githubToken>');
    });
  });

  describe('gitTagSuffix', () => {
    it('Should return the provided "git-tag-suffix"', () => {
      lookup['git-tag-suffix'] = '<gitTagSuffix>';
      const actual = getInputs(getters).gitTagSuffix;
      expect(actual).toStrictEqual('<gitTagSuffix>');
    });
  });

  describe('majorTypes', () => {
    it('Should return an empty list of no major types are provided', () => {
      lookup['major-types'] = '';
      const actual = getInputs(getters).majorTypes;
      expect(actual).toStrictEqual([]);
    });

    it('Should return the provided "major-types"', () => {
      lookup['major-types'] = '<major1>,<major2>';
      const actual = getInputs(getters).majorTypes;
      expect(actual).toStrictEqual(['<major1>', '<major2>']);
    });
  });

  describe('minorTypes', () => {
    it('Should return the default "minor-types" if it is not provided', () => {
      lookup['minor-types'] = '';
      const actual = getInputs(getters).minorTypes;
      expect(actual).toStrictEqual(['feat']);
    });

    it('Should return the provided "minor-types"', () => {
      lookup['minor-types'] = '<minor1>,<minor2>';
      const actual = getInputs(getters).minorTypes;
      expect(actual).toStrictEqual(['<minor1>', '<minor2>']);
    });
  });

  describe('releaseBranch', () => {
    it('Should return the default "release-branch" if it is not provided', () => {
      lookup['release-branch'] = '';
      const actual = getInputs(getters).releaseBranch;
      expect(actual).toStrictEqual('release');
    });

    it('Should return the provided "release-branch"', () => {
      lookup['release-branch'] = '<releaseBranch>';
      const actual = getInputs(getters).releaseBranch;
      expect(actual).toStrictEqual('<releaseBranch>');
    });
  });

  describe('trackingTag', () => {
    it('Should return the default "tracking-tag" if it is not provided', () => {
      lookup['tracking-tag'] = '';
      const actual = getInputs(getters).trackingTag;
      expect(actual).toStrictEqual('latest-src');
    });

    it('Should return the provided "tracking-tag"', () => {
      lookup['tracking-tag'] = '<trackingTag>';
      const actual = getInputs(getters).trackingTag;
      expect(actual).toStrictEqual('<trackingTag>');
    });
  });

  describe('versionOverride', () => {
    it('Should return null if no "version-override" is provided', () => {
      lookup['version-override'] = '';
      const actual = getInputs(getters).versionOverride;
      expect(actual).toStrictEqual(null);
    });

    it('Should return the provided "version-override"', () => {
      lookup['version-override'] = '0.1.2';
      const actual = getInputs(getters).versionOverride?.version;
      expect(actual).toStrictEqual('0.1.2');
    });

    it('Should throw an error if the "version-override" is not a valid semver value', () => {
      lookup['version-override'] = '<version-override>';
      const actual = () => getInputs(getters).versionOverride;
      expect(actual).toThrow('valid semver');
    });
  });
});
