import { DefaultLogFields, ListLogLine, SimpleGit, simpleGit } from 'simple-git';
import { Logger } from 'src/types/Logger.js';

export type Git = Pick<
  SimpleGit,
  | 'add'
  | 'addConfig'
  | 'branch'
  | 'commit'
  | 'fetch'
  | 'log'
  | 'merge'
  | 'push'
  | 'pushTags'
  | 'raw'
  | 'revparse'
  | 'status'
  | 'tag'
  | 'tags'
>;

export type GitHistoryEntry = DefaultLogFields & ListLogLine;

export class GitService {
  constructor(
    private readonly logger: Logger,
    private readonly git: Git = simpleGit(),
  ) {}

  async setUser(userName: string, email: string) {
    await this.git.addConfig('user.name', userName, false, 'local');
    await this.git.addConfig('user.email', email, false, 'local');
  }

  async status() {
    const status = await this.git.status();
    return { ...status, isClean: status.isClean() };
  }

  async getBranches() {
    return this.git.branch();
  }

  async switch(branchName: string, options: { create?: boolean } = {}) {
    const args = ['switch'];
    if (options.create) {
      args.push('-c');
    }
    args.push(branchName);
    return this.git.raw(args);
  }

  async merge(branchName: string, message?: string) {
    const args = [branchName, '--no-ff'];
    if (message) {
      args.push('-m', message);
    }
    return this.git.merge(args);
  }

  async addTags(tags: string[]) {
    return Promise.all(tags.map(async (tag) => this.git.tag([tag, '--force'])));
  }

  async pushTags() {
    return this.git.pushTags(['--force']);
  }

  async pushToRemote(setRemote?: { remote: string; branch: string }) {
    return this.git.push(setRemote?.remote, setRemote?.branch);
  }

  async amendCommitWithAllFiles() {
    await this.git.add('.');
    return this.git.raw(['commit', '--amend', '--no-edit']);
  }

  async commitAllFiles(message: string) {
    await this.git.add('.');
    return this.git.commit(message);
  }

  async getHistory(trackingTag: string, newCommitSha: string): Promise<readonly GitHistoryEntry[]> {
    await this.git.fetch(['--tags']);
    const tags = await this.git.tags();

    let fromSha: string | undefined;
    const isShallow = (await this.git.revparse(['--is-shallow-repository'])).trim() === 'true';
    this.logger.debug(`Repository is Shallow: ${isShallow}`);

    if (tags.all.includes(trackingTag)) {
      if (isShallow) {
        await this.git.fetch(['--shallow-exclude', trackingTag]);
        // Deepen one more to include the commit of the trackingTag itself to be able to use it below as the `from` sha
        await this.git.fetch(['--deepen', '1']);
      }

      fromSha = (await this.git.raw(['rev-list', '-n', '1', trackingTag])).trim();
    } else {
      this.logger.info(`Tracking tag "${trackingTag}" was not found in the git history, retrieving the full history.`);
      if (isShallow) {
        await this.git.fetch(['--unshallow']);
      }
    }

    this.logger.debug(`Git History Details: ${JSON.stringify({ trackingTag, fromSha, toSha: newCommitSha })}`);

    if (fromSha === newCommitSha) {
      return [];
    }

    const logOptions = fromSha ? { from: fromSha, to: newCommitSha } : undefined;
    const logs = await this.git.log(logOptions);

    return logs.all;
  }
}
