import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CatalogService } from '../catalog/catalog';
import { ContentManifest } from '../catalog/content-manifest.model';
import { PlatformService } from '../platform/platform.service';
import { AppUpdate } from './app-update';
import { ContentPack } from './content-pack';
import { ContentUpdate } from './content-update';
import { UpdateCoordinator } from './update-coordinator';
import { CONTENT_OFFLINE_MESSAGE, CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE } from './update.constants';
import manifestSeed from '../../../../content/manifests/content-manifest.json';

const seed = manifestSeed as unknown as ContentManifest;

function remoteWithNewExperience(): ContentManifest {
  return {
    ...seed,
    version: '0.7.0',
    experiences: [
      ...seed.experiences,
      {
        id: 'nueva-memory',
        brandId: 'radiesse',
        gameId: 'memory',
        version: '0.1.0',
        enabled: true,
        order: 99,
      },
    ],
  };
}

describe('UpdateCoordinator', () => {
  let loadManifest: ReturnType<typeof vi.fn<(raw: unknown) => boolean>>;
  let canApplyManifest: ReturnType<typeof vi.fn<(raw: unknown) => boolean>>;
  let fetchRemote: ReturnType<typeof vi.fn>;
  let apply: ReturnType<typeof vi.fn>;
  let pendingAssets: ReturnType<typeof vi.fn>;
  let appCheck: ReturnType<typeof vi.fn>;
  let downloadAndInstall: ReturnType<typeof vi.fn>;
  let installPack: ReturnType<typeof vi.fn>;
  let rollbackPack: ReturnType<typeof vi.fn>;
  let commitPack: ReturnType<typeof vi.fn>;
  let coordinator: UpdateCoordinator;

  beforeEach(() => {
    loadManifest = vi.fn<(raw: unknown) => boolean>().mockReturnValue(true);
    canApplyManifest = vi.fn<(raw: unknown) => boolean>().mockReturnValue(true);
    fetchRemote = vi.fn();
    apply = vi
      .fn()
      .mockImplementation((_catalog: CatalogService, raw: unknown) => loadManifest(raw));
    pendingAssets = vi.fn().mockReturnValue([]);
    appCheck = vi.fn().mockResolvedValue({ available: false });
    downloadAndInstall = vi.fn().mockResolvedValue({ ok: true, installed: false });
    installPack = vi.fn().mockResolvedValue({ kind: 'ok', installed: [] });
    rollbackPack = vi.fn().mockResolvedValue(undefined);
    commitPack = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));

    TestBed.configureTestingModule({
      providers: [
        UpdateCoordinator,
        {
          provide: CatalogService,
          useValue: {
            rawManifest: signal(seed).asReadonly(),
            loadManifest,
            canApplyManifest,
          },
        },
        {
          provide: PlatformService,
          useValue: {
            appVersion: signal('0.1.0'),
            isNative: false,
          },
        },
        {
          provide: ContentUpdate,
          useValue: {
            fetchRemote,
            apply,
            pendingAssets,
          },
        },
        {
          provide: ContentPack,
          useValue: {
            available: true,
            whenReady: async () => undefined,
            install: installPack,
            rollback: rollbackPack,
            commit: commitPack,
            clearInstalled: vi.fn(),
          },
        },
        {
          provide: AppUpdate,
          useValue: {
            check: appCheck,
            downloadAndInstall,
          },
        },
      ],
    });

    coordinator = TestBed.inject(UpdateCoordinator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mock de red caído deja status offline', async () => {
    fetchRemote.mockResolvedValue({
      kind: 'offline',
      errorMessage: CONTENT_OFFLINE_MESSAGE,
    });

    await coordinator.check();
    expect(coordinator.snapshot().status).toBe('offline');
    expect(coordinator.snapshot().errorMessage).toBe(CONTENT_OFFLINE_MESSAGE);
    expect(loadManifest).not.toHaveBeenCalled();
  });

  it('manifest remoto inválido no llama éxito de loadManifest', async () => {
    fetchRemote.mockResolvedValue({
      kind: 'error',
      errorMessage: 'El manifest remoto es inválido o está corrupto.',
    });

    await coordinator.check();
    expect(coordinator.snapshot().status).toBe('error');
    expect(loadManifest).not.toHaveBeenCalled();
  });

  it('manifest bueno + apply llega a completed y activa el catálogo', async () => {
    const remote = remoteWithNewExperience();
    fetchRemote.mockResolvedValue({ kind: 'ok', remote });

    await coordinator.check();
    expect(coordinator.snapshot().status).toBe('available');
    expect(
      coordinator
        .snapshot()
        .catalogDiff?.items.some((item) => item.id === 'nueva-memory' && item.kind === 'added'),
    ).toBe(true);

    await coordinator.apply();
    expect(installPack).toHaveBeenCalled();
    expect(loadManifest).toHaveBeenCalledWith(remote);
    expect(commitPack).toHaveBeenCalled();
    expect(coordinator.snapshot().status).toBe('completed');
    expect(coordinator.snapshot().catalogApplied).toBe(true);
  });

  it('loadManifest false hace rollback y no marca completed', async () => {
    const remote = remoteWithNewExperience();
    fetchRemote.mockResolvedValue({ kind: 'ok', remote });
    loadManifest.mockReturnValue(false);

    await coordinator.check();
    await coordinator.apply();

    expect(coordinator.snapshot().status).toBe('error');
    expect(coordinator.snapshot().catalogApplied).toBe(false);
    expect(rollbackPack).toHaveBeenCalled();
    expect(commitPack).not.toHaveBeenCalled();
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });

  it('fallo de download no llama éxito de loadManifest', async () => {
    const remote = remoteWithNewExperience();
    fetchRemote.mockResolvedValue({ kind: 'ok', remote });
    pendingAssets.mockReturnValue(['/content/images/nueva.png']);
    installPack.mockResolvedValue({
      kind: 'error',
      installed: [],
      errorMessage: CONTENT_PACK_DOWNLOAD_ERROR_MESSAGE,
    });

    await coordinator.check();
    await coordinator.apply();

    expect(loadManifest).not.toHaveBeenCalled();
    expect(coordinator.snapshot().status).toBe('error');
    expect(coordinator.snapshot().catalogApplied).toBe(false);
    expect(commitPack).not.toHaveBeenCalled();
  });

  it('minAppVersion incompatible no descarga pack', async () => {
    const remote = remoteWithNewExperience();
    fetchRemote.mockResolvedValue({ kind: 'ok', remote });
    canApplyManifest.mockReturnValue(false);

    await coordinator.check();
    await coordinator.apply();

    expect(installPack).not.toHaveBeenCalled();
    expect(loadManifest).not.toHaveBeenCalled();
    expect(coordinator.snapshot().status).toBe('error');
  });
});
