import { inject, Injectable, signal } from '@angular/core';
import { CatalogService } from '../catalog/catalog';
import { compareCatalogs } from '../catalog/compare-catalogs';
import { ContentManifest } from '../catalog/content-manifest.model';
import { UpdateSnapshot } from '../catalog/update.model';
import { PlatformService } from '../platform/platform.service';
import { AppUpdate } from './app-update';
import { ContentPack } from './content-pack';
import { ContentUpdate, FetchFn } from './content-update';
import {
  CONTENT_OFFLINE_MESSAGE,
  CONTENT_PACK_DESKTOP_ONLY_MESSAGE,
  CONTENT_PACK_INVALID_MESSAGE,
  fetchContentAssetIndex,
  type ContentIndexMap,
} from './update.constants';

function applyCompletionMessage(
  appError: string | undefined,
  appUpdateAvailable: boolean,
  skippedPack: boolean,
): string | undefined {
  if (appError) return `El contenido se actualizó, pero la app no: ${appError}`;
  if (appUpdateAvailable) {
    return 'Contenido actualizado. Si hay un nuevo ejecutable, la app puede reiniciarse.';
  }
  if (skippedPack) return undefined;
  return 'Contenido actualizado correctamente.';
}

/**
 * Orquesta contenido (archivos + JSON) y binario (Tauri). No se dispara al arrancar ni en splash.
 * Orden de instalación: pack a disco → JSON → ejecutable.
 */
@Injectable({ providedIn: 'root' })
export class UpdateCoordinator {
  private readonly catalog = inject(CatalogService);
  private readonly platform = inject(PlatformService);
  private readonly contentUpdate = inject(ContentUpdate);
  private readonly contentPack = inject(ContentPack);
  private readonly appUpdate = inject(AppUpdate);

  private pendingRemote: ContentManifest | null = null;
  private pendingHashes: ContentIndexMap = {};
  private lastFetchFn: FetchFn | undefined;

  private readonly _snapshot = signal<UpdateSnapshot>(this.idleSnapshot());
  readonly snapshot = this._snapshot.asReadonly();

  async check(fetchFn?: FetchFn): Promise<void> {
    this.pendingRemote = null;
    this.pendingHashes = {};
    this.lastFetchFn = fetchFn;
    this._snapshot.set({
      ...this.baseVersions(),
      status: 'checking',
    });

    const content = await this.contentUpdate.fetchRemote(fetchFn);
    if (content.kind === 'offline') {
      this._snapshot.set({
        ...this.baseVersions(),
        status: 'offline',
        errorMessage: content.errorMessage ?? CONTENT_OFFLINE_MESSAGE,
      });
      return;
    }

    if (content.kind === 'error' || !content.remote) {
      this._snapshot.set({
        ...this.baseVersions(),
        status: 'error',
        errorMessage: content.errorMessage ?? 'No se pudo consultar el catálogo remoto.',
      });
      return;
    }

    const local = this.catalog.rawManifest();
    const catalogDiff = compareCatalogs(local, content.remote);
    const pendingAssets = this.contentUpdate.pendingAssets(local, content.remote);
    const app = await this.appUpdate.check();
    this.pendingHashes = await fetchContentAssetIndex(undefined, fetchFn);

    this.pendingRemote = content.remote;

    const appNote = app.errorMessage;
    const hasWork = catalogDiff.hasChanges || app.available;

    this._snapshot.set({
      ...this.baseVersions(),
      status: hasWork ? 'available' : 'idle',
      catalogDiff,
      pendingAssets,
      appUpdateAvailable: app.available,
      remoteAppVersion: app.version,
      errorMessage: hasWork
        ? appNote
        : (appNote ?? 'No hay actualizaciones de contenido. El catálogo local sigue activo.'),
    });
  }

  async apply(): Promise<void> {
    const current = this._snapshot();
    if (current.status !== 'available' || !this.pendingRemote) {
      return;
    }

    const remote = this.pendingRemote;
    const pending = [...(current.pendingAssets ?? [])];

    if (!this.catalog.canApplyManifest(remote)) {
      this.setApplyFailure('error', CONTENT_PACK_INVALID_MESSAGE, true);
      return;
    }

    this._snapshot.set({
      ...current,
      status: 'downloading',
      errorMessage: undefined,
      downloadProgress: { completed: 0, total: pending.length },
    });

    const packResult = await this.contentPack.install(pending, {
      fetchFn: this.lastFetchFn,
      hashes: this.pendingHashes,
      catalogVersion: remote.version,
      onProgress: (progress) => {
        const snap = this._snapshot();
        this._snapshot.set({
          ...snap,
          downloadProgress: progress,
        });
      },
    });

    if (packResult.kind === 'offline') {
      this.setApplyFailure('offline', packResult.errorMessage ?? CONTENT_OFFLINE_MESSAGE);
      return;
    }

    if (packResult.kind === 'error') {
      this.setApplyFailure('error', packResult.errorMessage ?? CONTENT_PACK_INVALID_MESSAGE);
      return;
    }

    this._snapshot.set({
      ...this._snapshot(),
      status: 'installing',
    });

    if (!this.contentUpdate.apply(this.catalog, remote)) {
      await this.contentPack.rollback();
      this.setApplyFailure('error', CONTENT_PACK_INVALID_MESSAGE, true);
      return;
    }

    await this.contentPack.commit();
    const appError = await this.installAppIfNeeded(current.appUpdateAvailable);
    const skippedPack = packResult.kind === 'skipped' && pending.length > 0;
    this.pendingRemote = null;
    this._snapshot.set({
      ...this.baseVersions(),
      status: appError ? 'error' : 'completed',
      catalogApplied: true,
      note: skippedPack ? CONTENT_PACK_DESKTOP_ONLY_MESSAGE : undefined,
      errorMessage: applyCompletionMessage(appError, !!current.appUpdateAvailable, skippedPack),
    });
  }

  reset(): void {
    this.pendingRemote = null;
    this.pendingHashes = {};
    this._snapshot.set(this.idleSnapshot());
  }

  private setApplyFailure(
    status: 'error' | 'offline',
    message: string,
    clearPending = false,
  ): void {
    this._snapshot.set({
      ...this.baseVersions(),
      status,
      catalogApplied: false,
      errorMessage: message,
    });
    if (clearPending) this.pendingRemote = null;
  }

  private async installAppIfNeeded(available: boolean | undefined): Promise<string | undefined> {
    if (!available) return undefined;
    const appResult = await this.appUpdate.downloadAndInstall();
    return appResult.ok ? undefined : appResult.errorMessage;
  }

  private idleSnapshot(): UpdateSnapshot {
    return { ...this.baseVersions(), status: 'idle' };
  }

  private baseVersions(): Pick<UpdateSnapshot, 'appVersion' | 'catalogVersion'> {
    return {
      appVersion: this.platform.appVersion(),
      catalogVersion: this.catalog.rawManifest().version,
    };
  }
}
