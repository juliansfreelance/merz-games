import { inject, Injectable, signal } from '@angular/core';
import { CatalogService } from '../catalog/catalog';
import { compareCatalogs } from '../catalog/compare-catalogs';
import { UpdateSnapshot } from '../catalog/update.model';
import { PlatformService } from '../platform/platform.service';
import { AppUpdate } from './app-update';
import { ContentUpdate, FetchFn } from './content-update';
import { CONTENT_OFFLINE_MESSAGE } from './update.constants';

/**
 * Orquesta contenido (JSON) y binario (Tauri). No se dispara al arrancar ni en splash.
 * Orden de instalación: contenido primero, ejecutable al final.
 */
@Injectable({ providedIn: 'root' })
export class UpdateCoordinator {
  private readonly catalog = inject(CatalogService);
  private readonly platform = inject(PlatformService);
  private readonly contentUpdate = inject(ContentUpdate);
  private readonly appUpdate = inject(AppUpdate);

  private pendingRemote: unknown | null = null;

  private readonly _snapshot = signal<UpdateSnapshot>(this.idleSnapshot());
  readonly snapshot = this._snapshot.asReadonly();

  async check(fetchFn?: FetchFn): Promise<void> {
    this.pendingRemote = null;
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

    this._snapshot.set({
      ...current,
      status: 'downloading',
      errorMessage: undefined,
    });

    this._snapshot.set({
      ...this._snapshot(),
      status: 'installing',
    });

    const applied = this.contentUpdate.apply(this.catalog, this.pendingRemote);
    if (!applied) {
      this._snapshot.set({
        ...this.baseVersions(),
        status: 'error',
        catalogApplied: false,
        errorMessage:
          'El manifest remoto no es válido o es incompatible. Se conservó el catálogo anterior.',
      });
      this.pendingRemote = null;
      return;
    }

    let appError: string | undefined;
    if (current.appUpdateAvailable) {
      const appResult = await this.appUpdate.downloadAndInstall();
      if (!appResult.ok) {
        appError = appResult.errorMessage;
      }
    }

    this.pendingRemote = null;
    this._snapshot.set({
      ...this.baseVersions(),
      status: appError ? 'error' : 'completed',
      catalogApplied: true,
      errorMessage: appError
        ? `El contenido se actualizó, pero la app no: ${appError}`
        : current.appUpdateAvailable
          ? 'Contenido actualizado. Si hay un nuevo ejecutable, la app puede reiniciarse.'
          : 'Contenido actualizado correctamente.',
    });
  }

  reset(): void {
    this.pendingRemote = null;
    this._snapshot.set(this.idleSnapshot());
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
