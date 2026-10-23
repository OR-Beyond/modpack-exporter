export type MrpackErrorCode =
  | 'MRPACK_INVALID_INDEX'
  | 'FILE_HASH_MISMATCH'
  | 'MISSING_FILE_HASH'
  | 'DISALLOWED_DOWNLOAD_HOST'
  | 'UNSAFE_PATH'
  | 'DUPLICATE_PATH'
  | 'OVERRIDE_COLLISION'
  | 'INVALID_FILE_SIZE'
  | 'INVALID_ENV'
  | 'INVALID_TOP_LEVEL'
  | 'PATH_TRAVERSAL_IN_ZIP'
  | 'MISSING_INDEX';

export interface MrpackErrorDetail {
  code: MrpackErrorCode;
  file?: string;
  pointer?: string;
  detail?: string;
  expected?: string;
  actual?: string;
  causes?: string[];
  pathsTried?: string[];
  cause?: string;
}

export class MrpackError extends Error {
  public readonly detail: MrpackErrorDetail;
  constructor(detail: MrpackErrorDetail) {
    super(detail.detail ?? detail.code);
    this.name = 'MrpackError';
    this.detail = detail;
  }
}

export function toErrorPayload(e: unknown): { code: string; file?: string; pointer?: string; detail?: string; causes?: string[]; pathsTried?: string[]; cause?: string } {
  if (e instanceof MrpackError) {
    const d = e.detail;
    return { code: d.code, file: d.file, pointer: d.pointer, detail: d.detail, causes: d.causes, pathsTried: d.pathsTried, cause: d.cause };
  }
  if (e && typeof e === 'object' && 'code' in (e as any)) {
    const o = e as any;
    return { code: String(o.code), file: o.file, pointer: o.pointer, detail: o.detail ?? o.message, causes: o.causes, pathsTried: o.pathsTried, cause: o.cause };
  }
  return { code: 'UNKNOWN', detail: e instanceof Error ? e.message : String(e) };
}
