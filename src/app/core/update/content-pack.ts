import { inject, Injectable } from '@angular/core';
import { AppLogger } from '../logging/app-error';
import {
  BACKUP_DIR,
  CONTENT_DIR,
  CONTENT_FS,
  INCOMING_DIR,
  PACK_INDEX_REL,
  PackIndexFile,
} from '../platform/content-fs';
import { clearPackRuntime, hydratePackRuntime, toPackRelative } from '../platform/pack-runtime';
import { verifyAssetBytes } from './content-integrity';
import { localAssetToRemoteUrl, normalizeContentPath, toContentRel } from './content-remote-url';
import {
  CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE,
  CONTENT_PACK_HASH_ERROR_MESSAGE,
  CONTENT_OFFLINE_MESSAGE,
  type FetchFn,
  hashForAsset,
  type ContentIndexMap,
} from './update.constants';

export type ContentPackKind = 'ok' | 'skipped' | 'error' | 'offline';

export interface ContentPackProgress {
  readonly completed: number;
  readonly total: number;
  readonly currentPath?: string;
}

export interface ContentPackResult {
  readonly kind: ContentPackKind;
  readonly errorMessage?: string;
  readonly installed: readonly string[];
}

export interface InstallPackOptions {
  readonly fetchFn?: FetchFn;
  readonly hashes?: ContentIndexMap;
  readonly catalogVersion?: string;
  readonly onProgress?: (progress: ContentPackProgress) => void;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed/i.test(errorText(error));
}

function incomingRel(contentRel: string): string {
  return `${INCOMING_DIR}/${contentRel}`;
}

function contentFileRel(contentRel: string): string {
  return `${CONTENT_DIR}/${contentRel}`;
}

function backupFileRel(contentRel: string): string {
  return `${BACKUP_DIR}/${contentRel}`;
}

type PlannedAsset = { manifestPath: string; rel: string; remote: string };

function planPending(
  pending: readonly string[],
): { ok: true; planned: PlannedAsset[] } | { ok: false; result: ContentPackResult } {
  const planned: PlannedAsset[] = [];
  for (const raw of pending) {
    const manifestPath = normalizeContentPath(raw);
    const rel = toContentRel(raw);
    const remote = localAssetToRemoteUrl(raw);
    if (!manifestPath || !rel || !remote) {
      return {
        ok: false,
        result: {
          kind: 'error',
          installed: [],
          errorMessage: `Ruta de asset no permitida: ${raw}`,
        },
      };
    }
    planned.push({ manifestPath, rel, remote });
  }
  return { ok: true, planned };
}

function packErrorFromVerify(message: string | undefined): ContentPackResult {
  const hashFail = /hash/i.test(message ?? '');
  return {
    kind: 'error',
    installed: [],
    errorMessage: hashFail
      ? CONTENT_PACK_HASH_ERROR_MESSAGE
      : (message ?? CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE),
  };
}

@Injectable({ providedIn: 'root' })
export class ContentPack {
  private readonly fs = inject(CONTENT_FS);
  private readonly logger = inject(AppLogger);
  private ready: Promise<void> | null = null;
  private lastInstalled: string[] = [];

  whenReady(): Promise<void> {
    this.ready ??= this.hydrate();
    return this.ready;
  }

  get available(): boolean {
    return this.fs.available;
  }

  /**
   * Descarga `pending` a staging, verifica e instala en `content/`.
   * En navegador no toca disco (`skipped`).
   */
  async install(
    pending: readonly string[],
    options: InstallPackOptions = {},
  ): Promise<ContentPackResult> {
    await this.whenReady();
    if (!this.fs.available) {
      return { kind: 'skipped', installed: [] };
    }
    if (pending.length === 0) {
      return { kind: 'ok', installed: [] };
    }

    const planned = planPending(pending);
    if (!planned.ok) return planned.result;

    const stagingError = await this.prepareStaging();
    if (stagingError) return stagingError;

    const fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    const installedRels: string[] = [];

    try {
      for (let i = 0; i < planned.planned.length; i++) {
        const item = planned.planned[i]!;
        options.onProgress?.({
          completed: i,
          total: planned.planned.length,
          currentPath: item.manifestPath,
        });
        const stageError = await this.stageOne(item, fetchFn, options.hashes);
        if (stageError) return stageError;
        installedRels.push(item.rel);
      }

      options.onProgress?.({ completed: planned.planned.length, total: planned.planned.length });
      await this.swapStagedToContent(installedRels);
      this.lastInstalled = [...installedRels];
      await this.persistIndex(options.catalogVersion);
      await this.publishRuntime();
      await this.fs.remove(INCOMING_DIR, true);
      this.logger.info('ContentPack', `Pack instalado (${installedRels.length} archivo(s)).`);
      return { kind: 'ok', installed: installedRels };
    } catch (error) {
      return this.failInstall(error);
    }
  }

  private async prepareStaging(): Promise<ContentPackResult | null> {
    try {
      await this.fs.remove(INCOMING_DIR, true);
      await this.fs.mkdir(INCOMING_DIR);
      return null;
    } catch (error) {
      this.logger.error('ContentPack', 'No se pudo preparar staging', error);
      return { kind: 'error', installed: [], errorMessage: CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE };
    }
  }

  private async stageOne(
    item: PlannedAsset,
    fetchFn: FetchFn,
    hashes: ContentIndexMap | undefined,
  ): Promise<ContentPackResult | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await this.fs.remove(INCOMING_DIR, true);
      return { kind: 'offline', installed: [], errorMessage: CONTENT_OFFLINE_MESSAGE };
    }

    const bytes = await downloadBytes(item.remote, fetchFn);
    const expectedHash = hashForAsset(item.manifestPath, hashes);
    const verified = await verifyAssetBytes(item.manifestPath, bytes, expectedHash);
    if (!verified.ok) {
      await this.fs.remove(INCOMING_DIR, true);
      return packErrorFromVerify(verified.errorMessage);
    }

    await this.fs.writeFile(incomingRel(item.rel), bytes);
    return null;
  }

  private async swapStagedToContent(installedRels: string[]): Promise<void> {
    await this.fs.remove(BACKUP_DIR, true);
    await this.fs.mkdir(CONTENT_DIR);
    for (const rel of installedRels) {
      const dest = contentFileRel(rel);
      if (await this.fs.exists(dest)) {
        await this.fs.copyFile(dest, backupFileRel(rel));
      }
      if (await this.fs.exists(dest)) {
        await this.fs.remove(dest);
      }
      await this.fs.rename(incomingRel(rel), dest);
    }
  }

  private async failInstall(error: unknown): Promise<ContentPackResult> {
    await this.fs.remove(INCOMING_DIR, true).catch(() => undefined);
    if (isNetworkFailure(error)) {
      this.logger.warn('ContentPack', 'Red caída a mitad de descarga');
      return { kind: 'offline', installed: [], errorMessage: CONTENT_OFFLINE_MESSAGE };
    }
    const message = error instanceof Error ? error.message : CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE;
    this.logger.error('ContentPack', message, error);
    if (/hash/i.test(message)) {
      return { kind: 'error', installed: [], errorMessage: CONTENT_PACK_HASH_ERROR_MESSAGE };
    }
    return {
      kind: 'error',
      installed: [],
      errorMessage: /404|not found/i.test(message) ? message : CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE,
    };
  }

  /** Revierte los archivos del último `install` si `loadManifest` falló. */
  async rollback(): Promise<void> {
    if (!this.fs.available || this.lastInstalled.length === 0) {
      await this.publishRuntime();
      return;
    }
    try {
      for (const rel of this.lastInstalled) {
        const dest = contentFileRel(rel);
        const backup = backupFileRel(rel);
        await this.fs.remove(dest).catch(() => undefined);
        if (await this.fs.exists(backup)) {
          await this.fs.rename(backup, dest);
        }
      }
      this.lastInstalled = [];
      await this.fs.remove(BACKUP_DIR, true);
      await this.persistIndex();
      await this.publishRuntime();
      this.logger.warn('ContentPack', 'Pack revertido al estado anterior.');
    } catch (error) {
      this.logger.error('ContentPack', 'Rollback de pack falló', error);
    }
  }

  /** Confirma el pack: borra backup. */
  async commit(): Promise<void> {
    this.lastInstalled = [];
    if (!this.fs.available) return;
    await this.fs.remove(BACKUP_DIR, true).catch(() => undefined);
  }

  /** Restaurar fábrica: vacía packs OTA y vuelve al bundle. */
  async clearInstalled(): Promise<void> {
    await this.whenReady();
    this.lastInstalled = [];
    if (!this.fs.available) {
      clearPackRuntime();
      return;
    }
    try {
      await this.fs.remove(CONTENT_DIR, true);
      await this.fs.remove(INCOMING_DIR, true);
      await this.fs.remove(BACKUP_DIR, true);
      clearPackRuntime();
      this.logger.info('ContentPack', 'Packs OTA eliminados (fábrica).');
    } catch (error) {
      this.logger.error('ContentPack', 'No se pudieron vaciar los packs OTA', error);
      clearPackRuntime();
    }
  }

  private async hydrate(): Promise<void> {
    if (!this.fs.available) {
      clearPackRuntime();
      return;
    }
    try {
      const contentExists = await this.fs.exists(CONTENT_DIR);
      const backupExists = await this.fs.exists(BACKUP_DIR);
      if (!contentExists && backupExists) {
        await this.fs.rename(BACKUP_DIR, CONTENT_DIR);
        this.logger.warn('ContentPack', 'Se restauró content-backup tras un swap a medias.');
      }
      await this.publishRuntime();
    } catch (error) {
      this.logger.warn('ContentPack', 'No se pudo hidratar el pack OTA', error);
      clearPackRuntime();
    }
  }

  private async persistIndex(catalogVersion?: string): Promise<void> {
    const files = await this.listPackFiles();
    const payload: PackIndexFile = { catalogVersion, files };
    await this.fs.writeTextFile(PACK_INDEX_REL, JSON.stringify(payload));
  }

  private async listPackFiles(): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const listed = await this.fs.listFiles(CONTENT_DIR);
    for (const absRel of listed) {
      if (absRel.endsWith('/.pack-index.json')) continue;
      const packRel = toPackRelative(`/${absRel}`);
      if (!packRel) continue;
      files[packRel] = await this.fs.resolveAbsolute(absRel);
    }
    return files;
  }

  private async readIndexFiles(): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    if (!(await this.fs.exists(PACK_INDEX_REL))) return files;
    try {
      const parsed = JSON.parse(await this.fs.readTextFile(PACK_INDEX_REL)) as PackIndexFile;
      if (parsed?.files) Object.assign(files, parsed.files);
    } catch {
      this.logger.warn('ContentPack', 'Índice de pack corrupto; se reconstruye.');
    }
    return files;
  }

  private async publishRuntime(): Promise<void> {
    if (!this.fs.available) {
      clearPackRuntime();
      return;
    }
    let files = await this.readIndexFiles();
    if (Object.keys(files).length === 0 && (await this.fs.exists(CONTENT_DIR))) {
      files = await this.listPackFiles();
    }
    if (Object.keys(files).length === 0) {
      clearPackRuntime();
      return;
    }
    hydratePackRuntime({
      files,
      convertFileSrc: (absolutePath) => this.fs.convertSrc(absolutePath),
    });
  }
}

async function downloadBytes(url: string, fetchFn: FetchFn): Promise<Uint8Array> {
  const response = await fetchFn(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Archivo de contenido no encontrado (404): ${url}`);
    }
    throw new Error(`El host de contenido respondió ${response.status}.`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export function contentRelFromManifest(path: string): string | null {
  return toContentRel(path);
}

export function incomingPathFor(rel: string): string {
  return incomingRel(rel);
}
