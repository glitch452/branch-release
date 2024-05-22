// import semver from 'semver';
import { simpleGit } from 'simple-git';

const git = simpleGit();

// const testSemVer = semver.parse('v0.0.2');

// console.log(testSemVer?.version);
// const testSemVerInc = semver.parse(testSemVer?.version)?.inc('minor');
// console.log(testSemVer?.version);
// console.log(testSemVerInc?.version);

// console.log(semver.valid('v0.0.2'));
// console.log(semver.parse('v0.0.2'));
// console.log(semver.parse(null));

async function run() {
  // const status = await git.status();
  // console.log({ ...status, isClean: status.isClean() });
  const releaseBranch = 'temp';

  const branches = (await git.branch()).all.some((x) => x.replace(/^remotes\/origin\//, '') === releaseBranch);
  console.log(branches);
}

void run();
