export const DEFAULT_TYPE_TITLES = {
  breaking: 'BREAKING CHANGES',
  build: 'Build',
  chore: 'Chores',
  docs: 'Documentation',
  ci: 'Continuous Integration',
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance Improvements',
  refactor: 'Refactoring',
  test: 'Tests',
} as const;

export const CONVENTIONAL_COMMIT_REGEX = /^(?<type>[^(!:]+)(?:\((?<scope>[^)]*)\))?!?:\s*(?<description>.+)$/;
