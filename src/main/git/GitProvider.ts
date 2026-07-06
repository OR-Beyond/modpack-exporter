export interface StatusRow {
  filepath: string;
  head: 0 | 1 | 2 | 3;
  workdir: 0 | 1 | 2 | 3;
  stage: 0 | 1 | 2 | 3;
}

export interface CommitDescription {
  oid: string;
  message: string;
  author: { name: string; email: string; timestamp: number };
  committer: { name: string; email: string; timestamp: number };
  parent: string[];
}

export interface TreeEntry {
  status: 'added' | 'modified' | 'removed';
  path: string;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface PushResult {
  ok: boolean;
  neededUpstream: boolean;
}

export interface GitProvider {
  clone(url: string, dir: string, options?: {
    singleBranch?: boolean;
    depth?: number;
    branch?: string;
    onAuth?: () => { username?: string; password?: string } | Promise<{ username?: string; password?: string }>;
  }): Promise<void>;

  fetch(dir: string, options?: {
    remote?: string;
    ref?: string;
    noErrorIfMissing?: boolean;
    onAuth?: () => { username?: string; password?: string } | Promise<{ username?: string; password?: string }>;
  }): Promise<void>;

  push(dir: string, options?: {
    remote?: string;
    ref?: string;
    onAuth?: () => { username?: string; password?: string } | Promise<{ username?: string; password?: string }>;
  }): Promise<void>;

  add(dir: string, filepath: string): Promise<void>;
  addAll(dir: string): Promise<void>;
  remove(dir: string, filepath: string): Promise<void>;
  commit(dir: string, message: string, options?: { author?: { name: string; email: string } }): Promise<string>;
  currentBranch(dir: string): Promise<string>;
  statusMatrix(dir: string): Promise<StatusRow[]>;
  log(dir: string, options?: { depth?: number; ref?: string; since?: Date }): Promise<CommitDescription[]>;
  readBlob(dir: string, oid: string, filepath: string): Promise<Uint8Array>;
  getCommitTreeDiff(dir: string, oid: string): Promise<TreeEntry[]>;
  diffRefs(dir: string, ref1: string, ref2: string, pathPrefix?: string): Promise<string[]>;
  revertLastCommit(dir: string): Promise<string>;
  resetHard(dir: string, ref: string): Promise<void>;
  setRemoteUrl(dir: string, remote: string, url: string): Promise<void>;
  getConfig(dir: string, key: string): Promise<string>;
  setConfig(dir: string, key: string, value: string): Promise<void>;
  init(dir: string): Promise<void>;
  getAheadBehind(dir: string, upstream: string): Promise<AheadBehind>;
  remoteHasRef(dir: string, remote: string, ref: string): Promise<boolean>;
}
