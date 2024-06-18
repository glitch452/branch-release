# Branch Release

Automate the release of code where the dist files need to be published to a GitHub branch (i.e. a GitHub Action). Use
[Conventional Commits](https://www.conventionalcommits.org) to automatically update the release version and create
GitHub release notes, then build and push to the release branch with git tags for the new version.

## Table of Contents

- [Branch Release](#branch-release)
  - [Table of Contents](#table-of-contents)
  - [What's New](#whats-new)
  - [Features](#features)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Example Usage](#example-usage)
  - [License](#license)

## What's New

Check out the [GitHub Releases](https://github.com/glitch452/branch-release/releases) page for the latest release notes.

## Features

- Use the version information in GitHub Releases so there is no need to update the source or release branches with the
  current version.
- Determines the next version based on the commit messages since the last version, using
  [Conventional Commits](https://www.conventionalcommits.org) to determine whether to bump the major, minor or patch
  component of the [semver](https://semver.org) package version. The latest source commit is tracked automatically using
  a git tag.
- Runs the given build script to generate the updated package contents. There is no need to keep the dist files in the
  working branch.
- Pushes a commit to the release branch with the latest build contents.
- Generates releases using the conventional commit messages and create a GitHub Release with them.
- Adds tags to the new commit on the release branch
  - The `latest` tag gets set/moved to the current commit
  - A tag with the latest version gets added to the current commit (i.e. `v1.2.3`)
  - A tag with the major and minor version gets set/moved (i.e. `v1.2`)
  - A tag with the major version gets set/moved (i.e. `v1`)

## Inputs

| Input Name            | Type      | Details                                                                                                                                                                                                                                            |
| :-------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`        | `string`  | **REQUIRED** - A github token with access to write to the repository.                                                                                                                                                                              |
| `build-command`       | `string`  | The command to build the dist files for the project (ex. npm run build) **Default:** `''`                                                                                                                                                          |
| `changelog-titles`    | `string`  | A JSON encoded object, mapping the conventional commit type to the section title to use in the changelog for that type. These values will be merged into and override the default titles. (ex. `'{ "feat": "New Features" }'`) **Default:** `'{}'` |
| `disable-git-tagging` | `boolean` | Disable setting and/or updating the git tags. **Default:** `false`                                                                                                                                                                                 |
| `dry-run`             | `boolean` | Run the action without actually releasing the package or pushing git tags. **Default:** `false`                                                                                                                                                    |
| `git-tag-suffix`      | `string`  | A value append to the git tags. **Default:** `''`                                                                                                                                                                                                  |
| `major-types`         | `string`  | A comma-separated list of conventional commit types that trigger a major version change. **Default:** `''`                                                                                                                                         |
| `minor-types`         | `string`  | A comma-separated list of conventional commit types that trigger a minor version change. **Default:** `'feat'`                                                                                                                                     |
| `release-branch`      | `string`  | The name of the branch to publish the release to. **Default:** `'release'`                                                                                                                                                                         |
| `tracking-tag`        | `string`  | The name of the tag to put on the source branch to track the source of the latest Release. **Default:** `'latest-src'`                                                                                                                             |
| `version-override`    | `string`  | The version to use for publishing the package instead of determining the version using conventional commits. **Default:** `''`                                                                                                                     |

## Outputs

| Output Name          | Details                                                         |
| :------------------- | :-------------------------------------------------------------- |
| `current-version`    | The version of the package before it is updated (ex. `1.2.2`).  |
| `increment-type`     | The type of version increment in `['major', 'minor', 'patch']`. |
| `next-version`       | The new version of the package (ex. `1.2.3`).                   |
| `next-version-major` | The major portion of the new version of the package (ex. `1`).  |
| `next-version-minor` | The minor portion of the new version of the package (ex. `2`).  |
| `next-version-patch` | The patch portion of the new version of the package (ex. `3`).  |

## Example Usage

```yaml
jobs:
  release:
    name: Release the Project
    runs-on: ubuntu-latest
    permissions:
      # Add repo write permissions to the GITHUB_TOKEN
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Optionally, use a deploy key to bypass branch protection rules
          ssh-key: ${{ secrets.DEPLOY_KEY }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x

      - name: Install Dependencies
        run: npm ci

      - name: Release the Project on the branch 'main'
        id: release_main
        uses: glitch452/branch-release@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          release-branch: main
          build-command: npm run build

      - name: Print Outputs
        run: |
          echo "${{ toJSON(steps.release_main.outputs) }}"
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE) as defined by the
[Open Source Initiative](https://opensource.org/license/mit).
