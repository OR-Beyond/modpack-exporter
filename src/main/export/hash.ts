import crypto from 'crypto';
import fs from 'fs';
import { Readable } from 'stream';

export interface HashResult {
  sha1: string;
  sha512: string;
  size: number;
}

export interface HashOptions {
  signal?: AbortSignal;
}

/**
 * Stream a file once, computing SHA1 and SHA512 in the same pass, plus its
 * byte size. Bounded memory: never reads the whole file into RAM.
 */
export async function hashFile(filePath: string, options?: HashOptions): Promise<HashResult> {
  const signal = options?.signal;
  const sha1 = crypto.createHash('sha1');
  const sha512 = crypto.createHash('sha512');
  let size = 0;

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    const onAbort = () => {
      stream.destroy(new Error('Aborted'));
    };
    if (signal) {
      if (signal.aborted) {
        stream.destroy(new Error('Aborted'));
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
    stream.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      sha1.update(buf);
      sha512.update(buf);
      size += buf.length;
      if (signal?.aborted) stream.destroy(new Error('Aborted'));
    });
    stream.on('end', () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    });
    stream.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });
  });

  return { sha1: sha1.digest('hex'), sha512: sha512.digest('hex'), size };
}

/**
 * Hash an in-memory Buffer (small inputs only; used for validator cross-checks
 * on extracted ZIP entries).
 */
export function hashBuffer(buf: Buffer): HashResult {
  return {
    sha1: crypto.createHash('sha1').update(buf).digest('hex'),
    sha512: crypto.createHash('sha512').update(buf).digest('hex'),
    size: buf.length,
  };
}

export function isLowerHex(s: string, len: number): boolean {
  return typeof s === 'string' && s.length === len && /^[0-9a-f]+$/.test(s);
}
