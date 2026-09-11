import { InjectionToken } from '@angular/core';

export const CONTENT_DIR = 'content';
export const INCOMING_DIR = 'content-incoming';
export const BACKUP_DIR = 'content-backup';
export const PACK_INDEX_REL = `${CONTENT_DIR}/.pack-index.json`;

export interface PackIndexFile {
  readonly catalogVersion?: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface ContentFsApi {
  /** `false` en navegador: no hay disco de packs. */
  readonly available: boolean;
  exists(rel: string): Promise<boolean>;
  mkdir(rel: string): Promise<void>;
  writeFile(rel: string, data: Uint8Array): Promise<void>;
  writeTextFile(rel: string, data: string): Promise<void>;
  readFile(rel: string): Promise<Uint8Array>;
  readTextFile(rel: string): Promise<string>;
  remove(rel: string, recursive?: boolean): Promise<void>;
  rename(fromRel: string, toRel: string): Promise<void>;
  copyFile(fromRel: string, toRel: string): Promise<void>;
  /** Rutas de archivo relativas a AppLocalData bajo `prefix`. */
  listFiles(prefix: string): Promise<string[]>;
  resolveAbsolute(rel: string): Promise<string>;
  convertSrc(absolutePath: string): string;
}

function norm(rel: string): string {
  let n = rel.replaceAll('\\', '/');
  while (n.startsWith('/')) n = n.slice(1);
  while (n.endsWith('/') && n.length > 0) n = n.slice(0, -1);
  return n;
}

export class BrowserContentFs implements ContentFsApi {
  readonly available = false;

  async exists(): Promise<boolean> {
    return false;
  }
  async mkdir(): Promise<void> {
    /* no-op */
  }
  async writeFile(): Promise<void> {
    throw new Error('Solo en la app nativa');
  }
  async writeTextFile(): Promise<void> {
    throw new Error('Solo en la app nativa');
  }
  async readFile(): Promise<Uint8Array> {
    throw new Error('Solo en la app nativa');
  }
  async readTextFile(): Promise<string> {
    throw new Error('Solo en la app nativa');
  }
  async remove(): Promise<void> {
    /* no-op */
  }
  async rename(): Promise<void> {
    /* no-op */
  }
  async copyFile(): Promise<void> {
    throw new Error('Solo en la app nativa');
  }
  async listFiles(): Promise<string[]> {
    return [];
  }
  async resolveAbsolute(rel: string): Promise<string> {
    return rel;
  }
  convertSrc(absolutePath: string): string {
    return absolutePath;
  }
}

/** FS inyectable para tests (mapa en memoria). */
export class MemoryContentFs implements ContentFsApi {
  readonly available = true;
  private readonly store = new Map<string, Uint8Array>();
  private readonly absRoot = '/mem/applocaldata';

  snapshot(): ReadonlyMap<string, Uint8Array> {
    return this.store;
  }

  async exists(rel: string): Promise<boolean> {
    const n = norm(rel);
    if (this.store.has(n)) return true;
    const prefix = `${n}/`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async mkdir(): Promise<void> {
    /* directorios implícitos */
  }

  async writeFile(rel: string, data: Uint8Array): Promise<void> {
    this.store.set(norm(rel), data);
  }

  async writeTextFile(rel: string, data: string): Promise<void> {
    await this.writeFile(rel, new TextEncoder().encode(data));
  }

  async readFile(rel: string): Promise<Uint8Array> {
    const data = this.store.get(norm(rel));
    if (!data) throw new Error(`No existe ${rel}`);
    return data;
  }

  async readTextFile(rel: string): Promise<string> {
    return new TextDecoder().decode(await this.readFile(rel));
  }

  async remove(rel: string, recursive = false): Promise<void> {
    const n = norm(rel);
    if (recursive) {
      const prefix = `${n}/`;
      const keys = [...this.store.keys()];
      for (const key of keys) {
        if (key === n || key.startsWith(prefix)) this.store.delete(key);
      }
      return;
    }
    this.store.delete(n);
  }

  async rename(fromRel: string, toRel: string): Promise<void> {
    const from = norm(fromRel);
    const to = norm(toRel);
    if (this.store.has(from)) {
      this.store.set(to, this.store.get(from)!);
      this.store.delete(from);
      return;
    }
    const prefix = `${from}/`;
    const keys = [...this.store.keys()];
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(from.length);
        this.store.set(norm(`${to}${rest}`), this.store.get(key)!);
        this.store.delete(key);
      }
    }
  }

  async copyFile(fromRel: string, toRel: string): Promise<void> {
    const data = await this.readFile(fromRel);
    await this.writeFile(toRel, new Uint8Array(data));
  }

  async listFiles(prefix: string): Promise<string[]> {
    const n = norm(prefix);
    const dirPrefix = `${n}/`;
    return [...this.store.keys()].filter((key) => key === n || key.startsWith(dirPrefix));
  }

  async resolveAbsolute(rel: string): Promise<string> {
    return `${this.absRoot}/${norm(rel)}`;
  }

  convertSrc(absolutePath: string): string {
    return `asset://localhost${absolutePath.startsWith('/') ? '' : '/'}${absolutePath}`;
  }
}

export class TauriContentFs implements ContentFsApi {
  readonly available = true;
  private absRoot: string | null = null;
  private convertFn: ((path: string) => string) | null = null;

  private async api() {
    const fs = await import('@tauri-apps/plugin-fs');
    const path = await import('@tauri-apps/api/path');
    const core = await import('@tauri-apps/api/core');
    this.convertFn = core.convertFileSrc;
    return { fs, path, base: { baseDir: path.BaseDirectory.AppLocalData } };
  }

  async exists(rel: string): Promise<boolean> {
    const { fs, base } = await this.api();
    return fs.exists(norm(rel), base);
  }

  async mkdir(rel: string): Promise<void> {
    const { fs, base } = await this.api();
    await fs.mkdir(norm(rel), { ...base, recursive: true });
  }

  async writeFile(rel: string, data: Uint8Array): Promise<void> {
    const parent = parentOf(norm(rel));
    if (parent) await this.mkdir(parent);
    const { fs, base } = await this.api();
    await fs.writeFile(norm(rel), data, base);
  }

  async writeTextFile(rel: string, data: string): Promise<void> {
    const parent = parentOf(norm(rel));
    if (parent) await this.mkdir(parent);
    const { fs, base } = await this.api();
    await fs.writeTextFile(norm(rel), data, base);
  }

  async readFile(rel: string): Promise<Uint8Array> {
    const { fs, base } = await this.api();
    return fs.readFile(norm(rel), base);
  }

  async readTextFile(rel: string): Promise<string> {
    const { fs, base } = await this.api();
    return fs.readTextFile(norm(rel), base);
  }

  async remove(rel: string, recursive = false): Promise<void> {
    const { fs, base } = await this.api();
    if (!(await this.exists(rel))) return;
    await fs.remove(norm(rel), { ...base, recursive });
  }

  async rename(fromRel: string, toRel: string): Promise<void> {
    const parent = parentOf(norm(toRel));
    if (parent) await this.mkdir(parent);
    const { fs, base } = await this.api();
    await fs.rename(norm(fromRel), norm(toRel), {
      oldPathBaseDir: base.baseDir,
      newPathBaseDir: base.baseDir,
    });
  }

  async copyFile(fromRel: string, toRel: string): Promise<void> {
    const parent = parentOf(norm(toRel));
    if (parent) await this.mkdir(parent);
    const { fs, base } = await this.api();
    await fs.copyFile(norm(fromRel), norm(toRel), {
      fromPathBaseDir: base.baseDir,
      toPathBaseDir: base.baseDir,
    });
  }

  async listFiles(prefix: string): Promise<string[]> {
    if (!(await this.exists(prefix))) return [];
    const { fs, base } = await this.api();
    const out: string[] = [];
    await walk(fs, norm(prefix), out, base);
    return out;
  }

  async resolveAbsolute(rel: string): Promise<string> {
    const { path } = await this.api();
    if (!this.absRoot) {
      this.absRoot = await path.appLocalDataDir();
    }
    return path.join(this.absRoot, ...norm(rel).split('/').filter(Boolean));
  }

  convertSrc(absolutePath: string): string {
    if (!this.convertFn) {
      throw new Error('convertFileSrc no inicializado');
    }
    return this.convertFn(absolutePath);
  }
}

function parentOf(rel: string): string | null {
  const i = rel.lastIndexOf('/');
  if (i <= 0) return null;
  return rel.slice(0, i);
}

async function walk(
  fs: typeof import('@tauri-apps/plugin-fs'),
  dir: string,
  out: string[],
  base: { baseDir: number },
): Promise<void> {
  const entries = await fs.readDir(dir, base);
  for (const entry of entries) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await walk(fs, child, out, base);
    } else if (entry.isFile) {
      out.push(child);
    }
  }
}

function detectNative(): boolean {
  if (typeof window === 'undefined') return false;
  const globals = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return !!globals.__TAURI_INTERNALS__ || !!globals.__TAURI__;
}

export function createContentFs(): ContentFsApi {
  return detectNative() ? new TauriContentFs() : new BrowserContentFs();
}

export const CONTENT_FS = new InjectionToken<ContentFsApi>('CONTENT_FS', {
  providedIn: 'root',
  factory: createContentFs,
});
