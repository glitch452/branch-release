import { getGitMock } from '../mocks/getGitMock.js';
import { getLoggerMock } from '../mocks/getLoggerMock.js';
import { GitService } from './GitService.js';

describe(GitService.name, () => {
  const gitMock = getGitMock();
  const loggerMock = getLoggerMock();
  const gitService = new GitService(loggerMock, gitMock);

  beforeEach(() => {
    gitMock.revparse.mockResolvedValue('true\n');
    gitMock.log.mockResolvedValue({ all: [] });
    gitMock.tags.mockResolvedValue({ all: [] });
    gitMock.raw.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe(GitService.prototype.setUser.name, () => {
    it('should set the given userName in the local scope', async () => {
      const userName = '<userName>';
      const email = '<email>';
      await gitService.setUser(userName, email);

      expect(gitMock.addConfig).toHaveBeenCalledWith('user.name', userName, false, 'local');
    });

    it('should set the given email address in the local scope', async () => {
      const userName = '<userName>';
      const email = '<email>';
      await gitService.setUser(userName, email);

      expect(gitMock.addConfig).toHaveBeenCalledWith('user.email', email, false, 'local');
    });
  });

  describe(GitService.prototype.status.name, () => {
    it('should add the value of isClean() to the returned object', async () => {
      gitMock.status.mockResolvedValue({ isClean: () => false, otherKey1: '<value1>', otherKey2: '<value2>' });
      const actual = await gitService.status();
      expect(actual).toStrictEqual(expect.objectContaining({ isClean: false }));
    });

    it('should include all the other properties of the git result in the returned object', async () => {
      gitMock.status.mockResolvedValue({ isClean: () => false, otherKey1: '<value1>', otherKey2: '<value2>' });
      const actual = await gitService.status();
      expect(actual).toStrictEqual(expect.objectContaining({ otherKey1: '<value1>', otherKey2: '<value2>' }));
    });
  });

  describe(GitService.prototype.getBranches.name, () => {
    it('should return the result of the call to git branch', async () => {
      const result = { detached: false, current: 'main', all: [], branches: {} };
      gitMock.branch.mockResolvedValue(result);
      const actual = await gitService.getBranches();
      expect(actual).toStrictEqual(expect.objectContaining(result));
    });
  });

  describe(GitService.prototype.switch.name, () => {
    it('should submit the raw git command', async () => {
      gitMock.raw.mockResolvedValue('<result>');
      await gitService.switch('<branchName>');
      expect(gitMock.raw).toHaveBeenCalledExactlyOnceWith(['switch', '<branchName>']);
    });

    it('should submit the raw git command with the "-c" flag when the create option is true', async () => {
      gitMock.raw.mockResolvedValue('<result>');
      await gitService.switch('<branchName>', { shouldCreate: true });
      expect(gitMock.raw).toHaveBeenCalledExactlyOnceWith(['switch', '-c', '<branchName>']);
    });

    it('should return the result', async () => {
      gitMock.raw.mockResolvedValue('<result>');
      const actual = await gitService.switch('<branchName>');
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.merge.name, () => {
    it('should submit the given branch name', async () => {
      await gitService.merge('<branchName>');
      expect(gitMock.merge).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining(['<branchName>']));
    });

    it('should add the "--no-ff" flag to the command', async () => {
      await gitService.merge('<branchName>');
      expect(gitMock.merge).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining(['--no-ff']));
    });

    it('should add the given message to the command', async () => {
      await gitService.merge('<branchName>', '<message>');
      expect(gitMock.merge).toHaveBeenCalledExactlyOnceWith(expect.arrayContaining(['-m', '<message>']));
    });

    it('should build the command with the arguments in the correct order', async () => {
      await gitService.merge('<branchName>', '<message>');
      expect(gitMock.merge).toHaveBeenCalledExactlyOnceWith(['<branchName>', '--no-ff', '-m', '<message>']);
    });

    it('should return the result', async () => {
      gitMock.merge.mockResolvedValue('<result>');
      const actual = await gitService.merge('<branchName>');
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.addTags.name, () => {
    it('should call the underlying tag method once for each tag provided', async () => {
      const tags = ['<tag1>', '<tag2>', '<tag3>', '<tag4>'];
      await gitService.addTags(tags);
      expect(gitMock.tag).toHaveBeenCalledTimes(tags.length);
    });

    it('should call the underlying tag method with the "--force" option for the first tag provided', async () => {
      const tags = ['<tag1>', '<tag2>'];
      await gitService.addTags(tags);

      expect(gitMock.tag).toHaveBeenCalledWith(['<tag1>', '--force']);
    });

    it('should call the underlying tag method with the "--force" option for the second tag provided', async () => {
      const tags = ['<tag1>', '<tag2>'];
      await gitService.addTags(tags);

      expect(gitMock.tag).toHaveBeenCalledWith(['<tag2>', '--force']);
    });
  });

  describe(GitService.prototype.pushTags.name, () => {
    it('should call the underlying pushTags method with the "--force" flag', async () => {
      await gitService.pushTags();
      expect(gitMock.pushTags).toHaveBeenCalledExactlyOnceWith(['--force']);
    });

    it('should return the result', async () => {
      gitMock.pushTags.mockResolvedValue('<result>');
      const actual = await gitService.pushTags();
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.pushToRemote.name, () => {
    it('should call the underlying pushToRemote method', async () => {
      await gitService.pushToRemote();

      expect(gitMock.push).toHaveBeenCalledOnce();
    });

    it('should include the given remote details', async () => {
      await gitService.pushToRemote({ remote: '<remote>', branch: '<branch>' });
      expect(gitMock.push).toHaveBeenCalledExactlyOnceWith('<remote>', '<branch>');
    });

    it('should return the result', async () => {
      gitMock.push.mockResolvedValue('<result>');
      const actual = await gitService.pushToRemote();
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.amendCommitWithAllFiles.name, () => {
    it('should call the underlying add method with "." to capture all the files in the current directory', async () => {
      await gitService.amendCommitWithAllFiles();
      expect(gitMock.add).toHaveBeenCalledExactlyOnceWith('.');
    });

    it('should call the underlying raw method with the commit command and the "--amend" and "--no-edit" flags', async () => {
      await gitService.amendCommitWithAllFiles();
      expect(gitMock.raw).toHaveBeenCalledExactlyOnceWith(['commit', '--amend', '--no-edit']);
    });

    it('should return the result from the underlying raw method', async () => {
      gitMock.raw.mockResolvedValue('<result>');
      const actual = await gitService.amendCommitWithAllFiles();
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.commitAllFiles.name, () => {
    it('should call the underlying add method with "." to capture all the files in the current directory', async () => {
      await gitService.commitAllFiles('<message>');
      expect(gitMock.add).toHaveBeenCalledExactlyOnceWith('.');
    });

    it('should call the underlying commit method with the given message', async () => {
      await gitService.commitAllFiles('<message>');
      expect(gitMock.commit).toHaveBeenCalledExactlyOnceWith('<message>');
    });

    it('should return the result from the underlying commit method', async () => {
      gitMock.commit.mockResolvedValue('<result>');
      const actual = await gitService.commitAllFiles('<message>');
      expect(actual).toBe('<result>');
    });
  });

  describe(GitService.prototype.getHistory.name, () => {
    const history = [
      {
        hash: 'hash1',
        date: 'date1',
        message: 'message1',
        refs: 'refs1',
        body: 'body1',
        author_name: 'author_name1',
        author_email: 'author_email1',
      },
      {
        hash: 'hash2',
        date: 'date2',
        message: 'message2',
        refs: 'refs2',
        body: 'body2',
        author_name: 'author_name2',
        author_email: 'author_email2',
      },
    ];
    const trackingTag = '<trackingTag>';
    const newCommitSha = '<newCommitSha>';

    beforeEach(() => {
      gitMock.log.mockResolvedValue({ all: history });
    });

    it('should check if the repo is a shallow clone by calling revparse with the "--is-shallow-repository" flag', async () => {
      await gitService.getHistory(trackingTag, newCommitSha);
      expect(gitMock.revparse).toHaveBeenCalledExactlyOnceWith(['--is-shallow-repository']);
    });

    it('should fetch the tags for the repo', async () => {
      await gitService.getHistory(trackingTag, newCommitSha);

      expect(gitMock.fetch).toHaveBeenCalledWith(['--tags']);
    });

    it('should call fetch with "--shallow-exclude" before "--deepen" when the repo is shallow and the tracking tag is in the list of tags', async () => {
      gitMock.tags.mockResolvedValue({ all: [trackingTag] });
      gitMock.revparse.mockResolvedValue('true\n');
      gitMock.raw.mockImplementation((args) => (args[0] === 'rev-list' ? '<fromSha>' : ''));
      await gitService.getHistory(trackingTag, newCommitSha);
      const actual = gitMock.fetch.mock.calls.map(([arg1]) => arg1);
      const expected = [['--tags'], ['--shallow-exclude', trackingTag], ['--deepen', '1']];
      expect(actual).toStrictEqual(expected);
    });

    it('should call fetch with "--unshallow" when the repo is shallow and the tracking tag NOT is in the list of tags', async () => {
      gitMock.tags.mockResolvedValue({ all: [] });
      gitMock.revparse.mockResolvedValue('true\n');
      gitMock.raw.mockImplementation((args) => (args[0] === 'rev-list' ? '<fromSha>' : ''));
      await gitService.getHistory(trackingTag, newCommitSha);
      const actual = gitMock.fetch.mock.calls.map(([arg1]) => arg1);
      const expected = [['--tags'], ['--unshallow']];
      expect(actual).toStrictEqual(expected);
    });

    it('should not return any history if the sha of the tracking tag matches the new commit sha', async () => {
      gitMock.tags.mockResolvedValue({ all: [trackingTag] });
      gitMock.raw.mockImplementation((args) => (args[0] === 'rev-list' ? newCommitSha : ''));
      const actual = await gitService.getHistory(trackingTag, newCommitSha);
      expect(actual).toStrictEqual([]);
    });

    it('should use the correct sha values when requesting the git history', async () => {
      gitMock.tags.mockResolvedValue({ all: [trackingTag] });
      gitMock.raw.mockImplementation((args) => (args[0] === 'rev-list' ? '<fromSha>' : ''));
      await gitService.getHistory(trackingTag, newCommitSha);
      const expected = { from: '<fromSha>', to: newCommitSha };
      expect(gitMock.log).toHaveBeenCalledExactlyOnceWith(expected);
    });

    it('should return the list of all history entries', async () => {
      gitMock.tags.mockResolvedValue({ all: [trackingTag] });
      gitMock.raw.mockImplementation((args) => (args[0] === 'rev-list' ? '<fromSha>' : ''));
      const actual = await gitService.getHistory(trackingTag, newCommitSha);
      expect(actual).toStrictEqual(history);
    });
  });
});
