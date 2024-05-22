import { getIncrementType } from './getIncrementType.js';
import { GitLogEntry } from './git-log-tools.js';

describe(getIncrementType.name, () => {
  const docs: GitLogEntry = { message: 'docs: updated readme', body: '' };
  const fix: GitLogEntry = { message: 'fix: updated readme', body: '' };
  const feat: GitLogEntry = { message: 'feat: added something new', body: '' };

  it('should return a "major" change when a commit body contains "BREAKING CHANGE" and a commit contains a minor type', () => {
    const actual = getIncrementType([docs, fix, feat, { ...feat, body: 'BREAKING CHANGE: Thing' }], [], ['feat']);
    expect(actual).toStrictEqual('major');
  });

  it('should return a "major" change when a commit body contains "BREAKING-CHANGE" and a commit contains a minor type', () => {
    const actual = getIncrementType([docs, fix, feat, { ...feat, body: 'BREAKING-CHANGE: Thing' }], [], ['feat']);
    expect(actual).toStrictEqual('major');
  });

  it('should return a "major" change when a commit message has a major type and a commit contains a minor type', () => {
    const actual = getIncrementType([docs, fix, feat, { message: 'major: Thing', body: '' }], ['major'], ['feat']);
    expect(actual).toStrictEqual('major');
  });

  it('should return a "major" change when a commit message has a "!:" and a commit contains a minor type', () => {
    const actual = getIncrementType([docs, fix, feat, { message: 'major!: Thing', body: '' }], [], ['feat']);
    expect(actual).toStrictEqual('major');
  });

  it('should return a "patch" change when none of the commit messages contain a major or minor type', () => {
    const actual = getIncrementType([docs, fix], ['major'], ['feat']);
    expect(actual).toStrictEqual('patch');
  });

  it('should return a "minor" change when one of the commit messages contains minor type', () => {
    const actual = getIncrementType([docs, fix, feat], ['major'], ['feat']);
    expect(actual).toStrictEqual('minor');
  });
});
