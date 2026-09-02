import { Component, computed, input, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Atmosphere, AtmosphereBlob } from '../../core/catalog/content-manifest.model';
import { DEFAULT_ATMOSPHERE } from '../../core/catalog/catalog';

interface BlobPair {
  primary: AtmosphereBlob;
  secondary: AtmosphereBlob;
}

interface LayerState {
  layerA: Atmosphere;
  layerB: Atmosphere | null;
  activeSlot: 'A' | 'B';
}

function isSameAtmosphere(a?: Atmosphere | null, b?: Atmosphere | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.baseColor !== b.baseColor) return false;
  if (a.blobs?.length !== b.blobs?.length) return false;
  return a.blobs.every(
    (blob, idx) =>
      blob.from === b.blobs[idx]?.from &&
      blob.to === b.blobs[idx]?.to &&
      blob.opacity === b.blobs[idx]?.opacity,
  );
}

/**
 * AtmosphereBlobs — Renderiza las 5 manchas de color vivas de una atmósfera.
 *
 * Cada mancha cuenta con:
 * - Capa primaria: color base asignado a esa mancha en el manifest.
 * - Capa secundaria: siguiente color de la paleta del manifest, con respiración lenta
 *   (24-32 segundos) para una transición orgánica y continua de color.
 */
@Component({
  selector: 'app-atmosphere-blobs',
  imports: [CommonModule],
  host: {
    'aria-hidden': 'true',
    class: 'block absolute inset-0 w-full h-full pointer-events-none',
  },
  template: `
    <!-- Blob 1: Superior izquierdo / halo alto -->
    @if (pair1(); as p1) {
      <div
        class="absolute -top-[10%] -left-[10%] w-[70%] h-[40%] rounded-full blur-[70px] animate-float-1 pointer-events-none"
      >
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-primary-1">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 40% 40%, ' + p1.primary.from + ' 0%, ' + p1.primary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p1.primary.opacity"
          ></div>
        </div>
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-secondary-1">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 40% 40%, ' + p1.secondary.from + ' 0%, ' + p1.secondary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p1.secondary.opacity"
          ></div>
        </div>
      </div>
    }

    <!-- Blob 2: Superior derecho / medio-alto -->
    @if (pair2(); as p2) {
      <div
        class="absolute top-[8%] -right-[10%] w-[65%] h-[38%] rounded-full blur-[75px] animate-float-4 pointer-events-none"
      >
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-primary-2">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 50% 50%, ' + p2.primary.from + ' 0%, ' + p2.primary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p2.primary.opacity"
          ></div>
        </div>
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-secondary-2">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 50% 50%, ' + p2.secondary.from + ' 0%, ' + p2.secondary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p2.secondary.opacity"
          ></div>
        </div>
      </div>
    }

    <!-- Blob 3: Centro / medio -->
    @if (pair3(); as p3) {
      <div
        class="absolute top-[32%] left-[10%] w-[65%] h-[38%] rounded-full blur-[75px] animate-float-3 pointer-events-none"
      >
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-primary-3">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 45% 45%, ' + p3.primary.from + ' 0%, ' + p3.primary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p3.primary.opacity"
          ></div>
        </div>
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-secondary-3">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 45% 45%, ' + p3.secondary.from + ' 0%, ' + p3.secondary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p3.secondary.opacity"
          ></div>
        </div>
      </div>
    }

    <!-- Blob 4: Medio-bajo derecho -->
    @if (pair4(); as p4) {
      <div
        class="absolute top-[54%] -right-[5%] w-[68%] h-[38%] rounded-full blur-[75px] animate-float-2 pointer-events-none"
      >
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-primary-4">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 50% 50%, ' + p4.primary.from + ' 0%, ' + p4.primary.to + ' 55%, transparent 75%)'"
            [style.opacity]="p4.primary.opacity"
          ></div>
        </div>
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-secondary-4">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 50% 50%, ' + p4.secondary.from + ' 0%, ' + p4.secondary.to + ' 55%, transparent 75%)'"
            [style.opacity]="p4.secondary.opacity"
          ></div>
        </div>
      </div>
    }

    <!-- Blob 5: Base inferior izquierda -->
    @if (pair5(); as p5) {
      <div
        class="absolute -bottom-[8%] -left-[8%] w-[70%] h-[40%] rounded-full blur-[70px] animate-float-5 pointer-events-none"
      >
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-primary-5">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 45% 45%, ' + p5.primary.from + ' 0%, ' + p5.primary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p5.primary.opacity"
          ></div>
        </div>
        <div class="absolute inset-0 w-full h-full rounded-full animate-color-secondary-5">
          <div
            class="w-full h-full rounded-full"
            [style.background]="'radial-gradient(circle at 45% 45%, ' + p5.secondary.from + ' 0%, ' + p5.secondary.to + ' 50%, transparent 75%)'"
            [style.opacity]="p5.secondary.opacity"
          ></div>
        </div>
      </div>
    }
  `,
})
export class AtmosphereBlobs {
  readonly atmosphere = input<Atmosphere>(DEFAULT_ATMOSPHERE);

  private getPair(idx: number): BlobPair {
    const list = this.atmosphere()?.blobs?.length
      ? this.atmosphere().blobs
      : DEFAULT_ATMOSPHERE.blobs;
    const count = list.length;
    return {
      primary: list[idx % count] ?? DEFAULT_ATMOSPHERE.blobs[0],
      secondary: list[(idx + 1) % count] ?? list[idx % count] ?? DEFAULT_ATMOSPHERE.blobs[0],
    };
  }

  protected readonly pair1 = computed(() => this.getPair(0));
  protected readonly pair2 = computed(() => this.getPair(1));
  protected readonly pair3 = computed(() => this.getPair(2));
  protected readonly pair4 = computed(() => this.getPair(3));
  protected readonly pair5 = computed(() => this.getPair(4));
}

/**
 * FloatingGradient — Fondo de atmósfera viva, luminosa, equilibrada y envolvente.
 *
 * Características:
 * - Doble capa reactiva con cross-dissolve suave de 2.5s al navegar entre marcas o pantallas.
 * - Manchas con rotación lenta y continua (24s-32s) entre los tonos definidos en el manifest.
 * - Totalmente acelerado por GPU (opacity y transform), optimizado para quiosco touch-screen.
 * - Respeta `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-floating-gradient',
  imports: [CommonModule, AtmosphereBlobs],
  host: {
    'aria-hidden': 'true',
    class: 'block absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0',
  },
  template: `
    <div
      class="absolute inset-0 w-full h-full transition-colors duration-[2500ms] ease-in-out overflow-hidden"
      [style.backgroundColor]="baseColor()"
    >
      <!-- Capa A -->
      @if (layerA(); as la) {
        <div
          class="absolute inset-0 w-full h-full transition-opacity duration-[2500ms] ease-in-out pointer-events-none"
          [class.opacity-100]="activeSlot() === 'A'"
          [class.opacity-0]="activeSlot() !== 'A'"
        >
          <app-atmosphere-blobs [atmosphere]="la" />
        </div>
      }

      <!-- Capa B -->
      @if (layerB(); as lb) {
        <div
          class="absolute inset-0 w-full h-full transition-opacity duration-[2500ms] ease-in-out pointer-events-none"
          [class.opacity-100]="activeSlot() === 'B'"
          [class.opacity-0]="activeSlot() !== 'B'"
        >
          <app-atmosphere-blobs [atmosphere]="lb" />
        </div>
      }

      <!-- Capa de textura y viñeta suave perimetral -->
      <div class="absolute inset-0 bg-radial from-transparent via-transparent to-black/35 pointer-events-none"></div>
    </div>
  `,
})
export class FloatingGradient {
  readonly atmosphere = input<Atmosphere>(DEFAULT_ATMOSPHERE);

  protected readonly baseColor = computed(
    () => this.atmosphere()?.baseColor ?? DEFAULT_ATMOSPHERE.baseColor,
  );

  protected readonly layers = linkedSignal<Atmosphere, LayerState>({
    source: this.atmosphere,
    computation: (newAtmo, previous) => {
      const atmo = newAtmo ?? DEFAULT_ATMOSPHERE;
      if (!previous) {
        return {
          layerA: atmo,
          layerB: null,
          activeSlot: 'A',
        };
      }

      const currentActiveAtmo =
        previous.value.activeSlot === 'A'
          ? previous.value.layerA
          : (previous.value.layerB ?? previous.value.layerA);

      if (isSameAtmosphere(currentActiveAtmo, atmo)) {
        return previous.value;
      }

      if (previous.value.activeSlot === 'A') {
        return {
          layerA: previous.value.layerA,
          layerB: atmo,
          activeSlot: 'B',
        };
      } else {
        return {
          layerA: atmo,
          layerB: previous.value.layerB,
          activeSlot: 'A',
        };
      }
    },
  });

  protected readonly activeSlot = computed(() => this.layers().activeSlot);
  protected readonly layerA = computed(() => this.layers().layerA);
  protected readonly layerB = computed(() => this.layers().layerB);

  protected readonly blob1 = computed(
    () => this.atmosphere()?.blobs?.[0] ?? DEFAULT_ATMOSPHERE.blobs[0],
  );
  protected readonly blob2 = computed(
    () => this.atmosphere()?.blobs?.[1] ?? DEFAULT_ATMOSPHERE.blobs[1] ?? this.blob1(),
  );
  protected readonly blob3 = computed(
    () => this.atmosphere()?.blobs?.[2] ?? DEFAULT_ATMOSPHERE.blobs[2] ?? this.blob1(),
  );
  protected readonly blob4 = computed(
    () => this.atmosphere()?.blobs?.[3] ?? DEFAULT_ATMOSPHERE.blobs[3] ?? this.blob2(),
  );
  protected readonly blob5 = computed(
    () => this.atmosphere()?.blobs?.[4] ?? DEFAULT_ATMOSPHERE.blobs[4] ?? this.blob1(),
  );
}
