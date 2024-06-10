import { CONVENTIONAL_COMMIT_REGEX, DEFAULT_TYPE_TITLES } from './constants.js';
import { GitLogEntry, createIsMajorChange } from './git-log-tools.js';

export function buildChangelog(
  gitHistory: readonly GitLogEntry[],
  typeTitles: Readonly<Record<string, string>> = DEFAULT_TYPE_TITLES,
  majorTypes: readonly string[] = [],
) {
  const isMajorChange = createIsMajorChange(majorTypes);
  const changesByType = new Map<string, string[]>();

  for (const entry of gitHistory) {
    const match = CONVENTIONAL_COMMIT_REGEX.exec(entry.message)?.groups;

    if (!match) {
      continue;
    }

    const { type: _type, scope, description } = match;
    const type = isMajorChange(entry) ? 'breaking' : _type;
    const change = scope ? `- ${scope}: ${description}` : `- ${description}`;

    const list = changesByType.get(type);
    if (list) {
      list.push(change);
    } else {
      changesByType.set(type, [change]);
    }
  }

  const outputLines: string[] = [];

  const breakingChanges = changesByType.get('breaking');
  if (breakingChanges) {
    changesByType.delete('breaking');
    outputLines.push(`# ${typeTitles.breaking ? typeTitles.breaking : 'BREAKING CHANGES'}`, ...breakingChanges, '');
  }

  for (const [type, lines] of changesByType) {
    outputLines.push(`# ${typeTitles[type] ? typeTitles[type] : type}`, ...lines, '');
  }

  return outputLines.join('\n');
}
