import fs from 'fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import path from 'path';

import type {
  GitProvider,
  StatusRow,
  CommitDescription,
  TreeEntry,
  AheadBehind,
} from './GitProvider';

type AuthCb = () => { username?: string; password?: string } | Promise<{ username?: string; password?: string }>;

function makeOnAuth(auth?: AuthCb) {
  return auth
    ? {
        onAuth: async () => {
          const creds = await auth();
          return creds;
        },
      }
    : {};
}

export class IsomorphicGitProvider implements GitProvider {
  async clone(
    url: string,
    dir: string,
    options?: {
      singleBranch?: boolean;
      depth?: number;
      branch?: string;
      onAuth?: AuthCb;
    },
  ): Promise<void> {
    fs.mkdirSync(dir, { recursive: true });
    await git.clone({
      fs,
      http,
      dir,
      url,
      singleBranch: options?.singleBranch ?? true,
      depth: options?.depth,
      ref: options?.branch ?? 'main',
      ...makeOnAuth(options?.onAuth),
    });
  }

  async fetch(
    dir: string,
    options?: {
      remote?: string;
      ref?: string;
      noErrorIfMissing?: boolean;
      onAuth?: AuthCb;
    },
  ): Promise<void> {
    try {
      await git.fetch({
        fs,
        http,
        dir,
        remote: options?.remote ?? 'origin',
        ref: options?.ref ?? 'main',
        ...makeOnAuth(options?.onAuth),
      });
    } catch (err: any) {
      if (options?.noErrorIfMissing && (err.message?.includes('remote ref') || err.message?.includes('unknown'))){
        return;
      }
      throw err;
    }
  }

  async push(
    dir: string,
    options?: {
      remote?: string;
      ref?: string;
      onAuth?: AuthCb;
    },
  ): Promise<void> {
    await git.push({
      fs,
      http,
      dir,
      remote: options?.remote ?? 'origin',
      ref: options?.ref ?? 'main',
      ...makeOnAuth(options?.onAuth),
    });
  }

  async add(dir: string, filepath: string): Promise<void> {
    await git.add({ fs, dir, filepath });
  }

  async addAll(dir: string): Promise<void> {
    const matrix = await git.statusMatrix({ fs, dir });
    for (const [fp, head, workdir] of matrix) {
      if (workdir) {
        await git.add({ fs, dir, filepath: fp });
      } else {
        await git.remove({ fs, dir, filepath: fp });
      }
    }
  }

  async remove(dir: string, filepath: string): Promise<void> {
    await git.remove({ fs, dir, filepath });
  }

  async commit(
    dir: string,
    message: string,
    options?: { author?: { name: string; email: string } },
  ): Promise<string> {
    const author = options?.author ?? { name: 'orbmodpack', email: 'orbmodpack@users.noreply.github.com' };
    return git.commit({ fs, dir, message, author, committer: author });
  }

  async currentBranch(dir: string): Promise<string> {
    const branch = await git.currentBranch({ fs, dir });
    if (!branch) throw new Error('Not on any branch (detached HEAD)');
    return branch;
  }

  async statusMatrix(dir: string): Promise<StatusRow[]> {
    const matrix = await git.statusMatrix({ fs, dir });
    return matrix.map(([filepath, head, workdir, stage]) => ({
      filepath: filepath as string,
      head: head as 0 | 1 | 2 | 3,
      workdir: workdir as 0 | 1 | 2 | 3,
      stage: stage as 0 | 1 | 2 | 3,
    }));
  }

  async log(
    dir: string,
    options?: { depth?: number; ref?: string; since?: Date },
  ): Promise<CommitDescription[]> {
    const commits = await git.log({
      fs,
      dir,
      depth: options?.depth,
      ref: options?.ref ?? 'HEAD',
      since: options?.since,
    });
    return commits.map(c => ({
      oid: c.oid,
      message: c.commit.message,
      author: { name: c.commit.author.name, email: c.commit.author.email, timestamp: c.commit.author.timestamp },
      committer: { name: c.commit.committer.name, email: c.commit.committer.email, timestamp: c.commit.committer.timestamp },
      parent: c.commit.parent,
    }));
  }

  async readBlob(dir: string, oid: string, filepath: string): Promise<Uint8Array> {
    const { blob } = await git.readBlob({ fs, dir, oid, filepath });
    return blob;
  }

  async getCommitTreeDiff(dir: string, oid: string): Promise<TreeEntry[]> {
    const commit = await git.readCommit({ fs, dir, oid });
    const parentOid = commit.commit.parent[0];
    if (!parentOid) {
      const tree = await git.walk({
        fs,
        dir,
        trees: [git.TREE({ ref: oid })],
        map: async (filepath, entries) => {
          if (filepath === '.') return;
          const type = entries[0] ? await (entries[0] as any).type() : undefined;
          if (type === 'tree') return;
          return { status: 'added' as const, path: filepath };
        },
      });
      return (await Promise.resolve(tree)).filter(Boolean) as TreeEntry[];
    }

    const files = await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: oid })],
      map: async (filepath, [parentTree, currentTree]) => {
        if (filepath === '.') return;
        const parentType = parentTree ? await (parentTree as any).type() : undefined;
        const currentType = currentTree ? await (currentTree as any).type() : undefined;
        if (parentType === 'tree' || currentType === 'tree') return;

        const parentOidVal = parentTree ? await (parentTree as any).oid() : undefined;
        const currentOidVal = currentTree ? await (currentTree as any).oid() : undefined;

        let status: 'added' | 'removed' | 'modified';
        if (parentOidVal === undefined) status = 'added';
        else if (currentOidVal === undefined) status = 'removed';
        else if (parentOidVal !== currentOidVal) status = 'modified';
        else return;

        return { status, path: filepath };
      },
    });
    return (await Promise.resolve(files)).filter(Boolean) as TreeEntry[];
  }

  async diffRefs(dir: string, ref1: string, ref2: string, pathPrefix?: string): Promise<string[]> {
    const files = await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref: ref1 }), git.TREE({ ref: ref2 })],
      map: async (filepath, [treeA, treeB]) => {
        if (filepath === '.') return;
        const typeA = treeA ? await (treeA as any).type() : undefined;
        const typeB = treeB ? await (treeB as any).type() : undefined;
        if (typeA === 'tree' || typeB === 'tree') return;

        const oidA = treeA ? await (treeA as any).oid() : undefined;
        const oidB = treeB ? await (treeB as any).oid() : undefined;
        if (oidA !== oidB) {
          if (!pathPrefix || filepath.startsWith(pathPrefix)) return filepath;
        }
      },
    });
    return (await Promise.resolve(files)).filter(Boolean) as string[];
  }

  async revertLastCommit(dir: string): Promise<string> {
    const commits = await git.log({ fs, dir, depth: 2 });
    if (commits.length < 2) throw new Error('No commits to undo (only one commit in history)');

    const currentOid = commits[0].oid;
    const parentOid = commits[1].oid;
    const changes = await this.getCommitTreeDiff(dir, currentOid);

    for (const change of changes) {
      switch (change.status) {
        case 'added': {
          if (fs.existsSync(path.join(dir, change.path))) {
            fs.rmSync(path.join(dir, change.path), { force: true });
          }
          break;
        }
        case 'removed': {
          try {
            const blob = await this.readBlob(dir, parentOid, change.path);
            const fullPath = path.join(dir, change.path);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, Buffer.from(blob));
          } catch {}
          break;
        }
        case 'modified': {
          try {
            const blob = await this.readBlob(dir, parentOid, change.path);
            fs.writeFileSync(path.join(dir, change.path), Buffer.from(blob));
          } catch {}
          break;
        }
      }
    }

    await this.addAll(dir);
    const oid = await this.commit(dir, `Revert ${currentOid.substring(0, 7)}`);
    return oid;
  }

  async resetHard(dir: string, ref: string): Promise<void> {
    await git.checkout({
      fs,
      dir,
      ref,
      force: true,
    });
  }

  async setRemoteUrl(dir: string, remote: string, url: string): Promise<void> {
    const gitdir = path.join(dir, '.git');
    const configPath = path.join(gitdir, 'config');
    try {
      await git.deleteRemote({ fs, dir, remote });
    } catch {}
    try {
      await git.addRemote({ fs, dir, remote, url });
    } catch {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const remoteSection = `[remote "${remote}"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/${remote}/*\n`;
      if (!configContent.includes(`[remote "${remote}"]`)) {
        fs.appendFileSync(configPath, '\n' + remoteSection);
      }
    }
  }

  async getConfig(dir: string, key: string): Promise<string> {
    const value = await git.getConfig({ fs, dir, path: key });
    if (value === undefined || value === null) throw new Error(`Config key not found: ${key}`);
    return value;
  }

  async setConfig(dir: string, key: string, value: string): Promise<void> {
    await git.setConfig({ fs, dir, path: key, value });
  }

  async init(dir: string): Promise<void> {
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    await git.init({ fs, dir });
  }

  async getAheadBehind(dir: string, upstream: string): Promise<AheadBehind> {
    try {
      const commits = await git.log({
        fs,
        dir,
        ref: upstream,
        depth: 1,
      });

      const localCommits = await git.log({ fs, dir, depth: 1000 });
      const upstreamSet = new Set<string>();
      for (const c of commits) upstreamSet.add(c.oid);

      let ahead = 0;
      let behind = 0;

      for (const c of localCommits) {
        if (!upstreamSet.has(c.oid)) ahead++;
        else break;
      }

      if (upstreamSet.size > 0) {
        const upstreamCommits = await git.log({
          fs,
          dir,
          ref: upstream,
          depth: 1000,
        });
        const localSet = new Set(localCommits.map(c => c.oid));
        for (const c of upstreamCommits) {
          if (!localSet.has(c.oid)) behind++;
          else break;
        }
      }

      return { ahead, behind };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  async remoteHasRef(dir: string, remote: string, ref: string): Promise<boolean> {
    try {
      await git.fetch({
        fs,
        http,
        dir,
        remote,
        ref,
        depth: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}
