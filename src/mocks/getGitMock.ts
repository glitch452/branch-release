import type { Git } from '../services/GitService.js';

export function getGitMock() {
  return {
    add: vi.fn(),
    addConfig: vi.fn(),
    branch: vi.fn(),
    commit: vi.fn(),
    fetch: vi.fn(),
    log: vi.fn(),
    merge: vi.fn(),
    push: vi.fn(),
    pushTags: vi.fn(),
    raw: vi.fn(),
    revparse: vi.fn(),
    status: vi.fn(),
    tag: vi.fn(),
    tags: vi.fn(),
  } satisfies Git;
}
