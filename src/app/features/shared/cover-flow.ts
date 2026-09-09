import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { KioskSettings } from '../../core/settings/kiosk-settings';

/** Contexto expuesto a cada `ng-template` del Cover Flow. */
export interface CoverFlowTemplateContext<T = unknown> {
  $implicit: T;
  active: boolean;
  index: number;
}

interface CoverFlowTrackable {
  id: string | number;
}

interface CardLayout {
  x: number;
  z: number;
  rotateY: number;
  zIndex: number;
  brightness: number;
}

type TickDirection = 'left' | 'right';

const DRAG_THRESHOLD_PX = 8;
const VELOCITY_FACTOR = 0.002;
const DEFAULT_DEPTH_Z = -200;
const SPRING_STIFFNESS = 150;
const SPRING_DAMPING = 30;
const SPRING_MASS = 1;
const SPRING_REST_EPSILON = 0.001;

const AudioCtxCtor: typeof AudioContext | null =
  typeof window !== 'undefined'
    ? (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ??
      null)
    : null;

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Cover Flow 3D horizontal reutilizable (perspectiva, drag, spring, rueda, audio).
 * El contenido de cada card se inyecta vía TemplateRef para no duplicar UI.
 */
@Component({
  selector: 'app-cover-flow',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full min-h-0',
  },
  template: `
    @if (items().length > 0) {
      <div
        #viewport
        class="cover-flow-viewport relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent outline-none select-none touch-pan-y"
        [class.is-dragging]="isDragging()"
        [class.cursor-grab]="!isDragging()"
        [class.cursor-grabbing]="isDragging()"
        [class.has-reflection]="showReflection()"
        role="region"
        [attr.aria-label]="ariaLabel()"
        tabindex="0"
        (keydown)="onKeyDown($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerCancel($event)"
        (lostpointercapture)="onLostPointerCapture()"
      >
        <div class="cover-flow-stage relative w-full h-full" aria-hidden="false">
          @for (item of items(); track trackItem(item); let i = $index) {
            <div
              #card
              class="cover-flow-card absolute top-1/2 left-1/2"
              [attr.data-index]="i"
              [attr.aria-hidden]="i === activeIndex() ? null : 'true'"
              (pointerup)="onCardPointerUp(i, $event)"
            >
              <div class="cover-flow-card-inner w-full h-full">
                <ng-container
                  [ngTemplateOutlet]="itemTemplate()"
                  [ngTemplateOutletContext]="contextFor(item, i)"
                />
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .cover-flow-viewport {
      perspective: 1000px;
      -webkit-user-select: none;
      user-select: none;
      touch-action: pan-y;
    }

    .cover-flow-stage {
      transform-style: preserve-3d;
      pointer-events: none;
    }

    .cover-flow-card {
      transform-style: preserve-3d;
      will-change: transform, filter;
      pointer-events: auto;
      backface-visibility: hidden;
    }

    .cover-flow-card-inner {
      width: 100%;
      height: 100%;
      pointer-events: auto;
    }

    .cover-flow-viewport.has-reflection .cover-flow-card-inner {
      -webkit-box-reflect: below 2px
        linear-gradient(to bottom, transparent 55%, rgba(0, 0, 0, 0.35));
    }

    .cover-flow-card-inner ::ng-deep img {
      -webkit-user-drag: none;
      user-drag: none;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .cover-flow-card {
        will-change: auto;
      }
    }
  `,
})
export class CoverFlow {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(KioskSettings);

  /** Elementos a mostrar (deben exponer `id` estable). */
  readonly items = input.required<CoverFlowTrackable[]>();
  /** Template de cada card (`let-item`, `let-active="active"`, `let-index="index"`). */
  readonly itemTemplate =
    input.required<TemplateRef<CoverFlowTemplateContext>>();
  readonly initialIndex = input(0);
  readonly itemWidth = input(460);
  readonly itemHeight = input(520);
  readonly itemAspectRatio = input<number | null>(null);
  readonly rotation = input(50);
  readonly centerGap = input(250);
  readonly stackSpacing = input(100);
  readonly depthZ = input(DEFAULT_DEPTH_Z);
  readonly enableClickToSnap = input(true);
  readonly enableReflection = input(true);
  readonly enableScroll = input(true);
  readonly enableAudio = input(true);
  readonly reduceMotion = input(false);
  readonly scrollThreshold = input(100);
  readonly ariaLabel = input('Cover Flow');
  readonly springStiffness = input(SPRING_STIFFNESS);
  readonly springDamping = input(SPRING_DAMPING);
  readonly springMass = input(SPRING_MASS);

  readonly activeIndexChange = output<number>();
  readonly itemSelected = output<{ item: CoverFlowTrackable; index: number }>();

  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly cardEls = viewChildren<ElementRef<HTMLElement>>('card');

  protected readonly activeIndex = signal(0);
  protected readonly isDragging = signal(false);
  protected readonly showReflection = signal(false);

  private readonly containerSize = signal({ width: 0, height: 0 });

  private scrollPosition = 0;
  private targetPosition = 0;
  private springVelocity = 0;
  private rafId: number | null = null;
  private lastFrameTs = 0;
  private resizeObserver: ResizeObserver | null = null;

  private pointerId: number | null = null;
  private dragStartX = 0;
  private lastPointerX = 0;
  private lastPointerTs = 0;
  private velocityX = 0;
  private didDrag = false;
  private suppressClick = false;
  private lastInitialIndex: number | null = null;
  private lastItemsKey = '';

  private audioCtx: AudioContext | null = null;
  private wheelAccumulator = 0;
  private wheelLastTime = 0;
  private wheelLastJump = 0;
  private removeWheel: (() => void) | null = null;

  private readonly metrics = computed(() => {
    const { width, height } = this.containerSize();
    const baseW = Math.max(1, this.itemWidth());
    const aspect = this.itemAspectRatio();
    const baseH =
      aspect && aspect > 0
        ? Math.round(baseW / aspect)
        : Math.max(1, this.itemHeight());

    if (width <= 0 || height <= 0) {
      return {
        width: baseW,
        height: baseH,
        centerGap: this.centerGap(),
        stackSpacing: this.stackSpacing(),
        scale: 1,
      };
    }

    const scaleW = (width * 0.78) / baseW;
    const scaleH = (height * 0.9) / baseH;
    const scale = Math.min(1, scaleW, scaleH);

    return {
      width: Math.round(baseW * scale),
      height: Math.round(baseH * scale),
      centerGap: Math.round(this.centerGap() * scale),
      stackSpacing: Math.round(this.stackSpacing() * scale),
      scale,
    };
  });

  constructor() {
    afterNextRender(() => {
      this.updateReflectionFlag();
      this.setupResizeObserver();
      this.setupWheel();
      this.syncFromInitialIndex(true);
      this.applyAllTransforms();
    });

    effect(() => {
      // Releer flags que afectan reflexión / rueda
      this.enableReflection();
      this.enableScroll();
      this.updateReflectionFlag();
      this.setupWheel();
    });

    effect(() => {
      const list = this.items();
      const initial = this.initialIndex();
      const length = list.length;
      if (length === 0) {
        this.lastItemsKey = '';
        return;
      }

      const itemsKey = list.map((item) => String(item.id)).join('|');
      const initialChanged = this.lastInitialIndex !== initial;
      const itemsChanged = this.lastItemsKey !== itemsKey;
      this.lastInitialIndex = initial;
      this.lastItemsKey = itemsKey;

      const current = clampIndex(this.activeIndex(), length);
      if (current !== this.activeIndex()) {
        this.activeIndex.set(current);
        this.scrollPosition = current;
        this.targetPosition = current;
      }

      if (initialChanged || (itemsChanged && this.activeIndex() >= length)) {
        const clamped = clampIndex(initial, length);
        queueMicrotask(() => this.jumpToIndex(clamped, true));
        return;
      }

      queueMicrotask(() => this.applyAllTransforms());
    });

    effect(() => {
      this.metrics();
      this.cardEls();
      queueMicrotask(() => this.applyAllTransforms());
    });

    this.destroyRef.onDestroy(() => {
      this.stopSpring();
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.removeWheel?.();
      this.removeWheel = null;
      void this.audioCtx?.close().catch(() => undefined);
      this.audioCtx = null;
    });
  }

  protected trackItem(item: CoverFlowTrackable): string | number {
    return item.id;
  }

  protected contextFor(
    item: CoverFlowTrackable,
    index: number,
  ): CoverFlowTemplateContext {
    return {
      $implicit: item,
      active: index === this.activeIndex(),
      index,
    };
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.jumpToIndex(this.activeIndex() - 1, false, 120, 'left');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.jumpToIndex(this.activeIndex() + 1, false, 120, 'right');
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (this.items().length <= 1) return;

    this.warmAudio();
    this.pointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.lastPointerX = event.clientX;
    this.lastPointerTs = performance.now();
    this.velocityX = 0;
    this.didDrag = false;
    this.suppressClick = false;
    this.stopSpring();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;

    const now = performance.now();
    const dx = event.clientX - this.lastPointerX;
    const dt = Math.max(now - this.lastPointerTs, 1);

    if (!this.didDrag) {
      if (Math.abs(event.clientX - this.dragStartX) < DRAG_THRESHOLD_PX) {
        return;
      }
      this.didDrag = true;
      this.suppressClick = true;
      this.zone.run(() => this.isDragging.set(true));
      this.viewport()?.nativeElement.setPointerCapture(event.pointerId);
    }

    const gap = Math.max(1, this.metrics().centerGap * 0.8);
    this.scrollPosition -= dx / gap;
    this.scrollPosition = this.clampScroll(this.scrollPosition);
    this.targetPosition = this.scrollPosition;
    this.springVelocity = 0;

    this.velocityX = (dx / dt) * 1000;
    this.lastPointerX = event.clientX;
    this.lastPointerTs = now;

    this.applyAllTransforms();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.finishPointer(event.pointerId);
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.finishPointer(event.pointerId);
  }

  protected onLostPointerCapture(): void {
    // noop
  }

  protected onCardPointerUp(index: number, event: PointerEvent): void {
    if (this.suppressClick || this.didDrag) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (index === this.activeIndex()) {
      return;
    }

    if (!this.enableClickToSnap()) return;

    event.preventDefault();
    event.stopPropagation();
    this.jumpToIndex(index);
  }

  private finishPointer(pointerId: number): void {
    const viewport = this.viewport()?.nativeElement;
    if (viewport?.hasPointerCapture(pointerId)) {
      viewport.releasePointerCapture(pointerId);
    }

    const wasDragging = this.didDrag;
    this.pointerId = null;

    if (wasDragging) {
      const projected =
        this.scrollPosition - this.velocityX * VELOCITY_FACTOR;
      const next = clampIndex(Math.round(projected), this.items().length);
      const prev = this.activeIndex();
      const dir: TickDirection = next >= prev ? 'right' : 'left';
      this.zone.run(() => {
        this.isDragging.set(false);
        this.commitActiveIndex(next);
      });
      this.animateTo(next);
      if (next !== prev) {
        this.playTick(dir, Math.abs(this.velocityX));
      }
    } else {
      this.zone.run(() => this.isDragging.set(false));
    }

    queueMicrotask(() => {
      this.didDrag = false;
      this.suppressClick = false;
    });
  }

  private jumpToIndex(
    index: number,
    silent = false,
    velocity = 0,
    direction?: TickDirection,
  ): void {
    const next = clampIndex(index, this.items().length);
    const prev = this.activeIndex();
    if (!silent) {
      this.commitActiveIndex(next);
    } else {
      this.activeIndex.set(next);
    }
    this.animateTo(next);
    if (!silent && next !== prev) {
      const dir: TickDirection =
        direction ?? (next > prev ? 'right' : 'left');
      this.playTick(dir, velocity);
    }
  }

  private commitActiveIndex(next: number): void {
    if (next === this.activeIndex()) return;
    this.activeIndex.set(next);
    this.activeIndexChange.emit(next);
  }

  private isReducedMotion(): boolean {
    return this.reduceMotion() || systemPrefersReducedMotion();
  }

  private animateTo(index: number): void {
    this.targetPosition = clampIndex(index, this.items().length);

    if (this.isReducedMotion()) {
      this.scrollPosition = this.targetPosition;
      this.springVelocity = 0;
      this.applyAllTransforms();
      return;
    }

    this.startSpring();
  }

  private startSpring(): void {
    this.stopSpring();
    this.zone.runOutsideAngular(() => {
      this.lastFrameTs = performance.now();
      const step = (ts: number) => {
        const dt = Math.min((ts - this.lastFrameTs) / 1000, 0.032);
        this.lastFrameTs = ts;

        const stiffness = this.springStiffness();
        const damping = this.springDamping();
        const mass = Math.max(0.001, this.springMass());
        const displacement = this.scrollPosition - this.targetPosition;
        const springForce = -stiffness * displacement;
        const dampingForce = -damping * this.springVelocity;
        const acceleration = (springForce + dampingForce) / mass;

        this.springVelocity += acceleration * dt;
        this.scrollPosition += this.springVelocity * dt;

        this.applyAllTransforms();

        const settled =
          Math.abs(displacement) < SPRING_REST_EPSILON &&
          Math.abs(this.springVelocity) < SPRING_REST_EPSILON;

        if (settled) {
          this.scrollPosition = this.targetPosition;
          this.springVelocity = 0;
          this.applyAllTransforms();
          this.rafId = null;
          return;
        }

        this.rafId = requestAnimationFrame(step);
      };

      this.rafId = requestAnimationFrame(step);
    });
  }

  private stopSpring(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private clampScroll(value: number): number {
    const max = Math.max(this.items().length - 1, 0);
    return Math.min(Math.max(value, 0), max);
  }

  private syncFromInitialIndex(force = false): void {
    const next = clampIndex(this.initialIndex(), this.items().length);
    if (force || next !== this.activeIndex()) {
      this.activeIndex.set(next);
    }
    this.scrollPosition = next;
    this.targetPosition = next;
    this.springVelocity = 0;
  }

  private setupResizeObserver(): void {
    const el = this.viewport()?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      this.zone.run(() => {
        this.containerSize.set({ width, height });
      });
    });
    this.resizeObserver.observe(el);
  }

  private updateReflectionFlag(): void {
    if (!this.enableReflection()) {
      this.showReflection.set(false);
      return;
    }
    // Evitar reflect en puntero grueso / viewports estrechos (como la referencia).
    const coarse =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(max-width: 768px), (pointer: coarse)').matches;
    this.showReflection.set(!coarse);
  }

  private setupWheel(): void {
    this.removeWheel?.();
    this.removeWheel = null;

    const el = this.viewport()?.nativeElement;
    if (!el || !this.enableScroll()) return;

    this.zone.runOutsideAngular(() => {
      const handler = (e: WheelEvent) => {
        if (!this.enableScroll()) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
        e.preventDefault();

        const now = Date.now();
        if (now - this.wheelLastTime > 200) this.wheelAccumulator = 0;
        this.wheelLastTime = now;
        this.wheelAccumulator += e.deltaX;

        const threshold = Math.max(1, this.scrollThreshold());
        const shouldJump =
          (this.wheelAccumulator > threshold ||
            this.wheelAccumulator < -threshold) &&
          now - this.wheelLastJump > 150;

        if (!shouldJump) return;

        const dir: TickDirection =
          this.wheelAccumulator > 0 ? 'right' : 'left';
        const next =
          Math.round(this.scrollPosition) + (dir === 'right' ? 1 : -1);
        this.zone.run(() =>
          this.jumpToIndex(next, false, Math.abs(e.deltaX), dir),
        );
        this.wheelAccumulator = 0;
        this.wheelLastJump = now;
      };

      el.addEventListener('wheel', handler, { passive: false });
      this.removeWheel = () => el.removeEventListener('wheel', handler);
    });
  }

  private warmAudio(): void {
    if (!this.enableAudio() || !AudioCtxCtor || !this.settings.soundEnabled()) {
      return;
    }
    if (!this.audioCtx) this.audioCtx = new AudioCtxCtor();
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => undefined);
    }
  }

  private playTick(direction: TickDirection, velocity = 1): void {
    if (!this.enableAudio() || !AudioCtxCtor || !this.settings.soundEnabled()) {
      return;
    }

    this.warmAudio();
    const ctx = this.audioCtx;
    if (!ctx) return;

    const t = ctx.currentTime;
    const vn = Math.min(Math.abs(velocity) / 300, 1);
    const peakGain = 0.28 * (0.55 + vn * 0.45);
    const freq = 1600 * (0.88 + vn * 0.24);
    const bodyDur = 0.022 - vn * 0.008;
    const clickDur = bodyDur * 0.3;
    const panStart = direction === 'left' ? 0.7 : -0.7;
    const panEnd = direction === 'left' ? -0.7 : 0.7;

    try {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panStart, t);
      panner.pan.linearRampToValueAtTime(panEnd, t + bodyDur);
      panner.connect(ctx.destination);

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(peakGain, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + bodyDur);
      bodyGain.connect(panner);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 6;
      filter.connect(bodyGain);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 1.25, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + bodyDur);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + bodyDur);

      const nSamples = Math.ceil(ctx.sampleRate * clickDur);
      const noiseBuf = ctx.createBuffer(1, nSamples, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      const randomWords = new Uint32Array(nSamples);
      crypto.getRandomValues(randomWords);
      for (let i = 0; i < nSamples; i++) {
        const unit = randomWords[i]! / 0x1_0000_0000;
        data[i] = (unit * 2 - 1) * Math.exp(-i / (nSamples * 0.2));
      }

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(peakGain * 0.35, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + clickDur);
      noiseGain.connect(panner);

      const noiseHp = ctx.createBiquadFilter();
      noiseHp.type = 'highpass';
      noiseHp.frequency.value = 2400;
      noiseHp.connect(noiseGain);

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.connect(noiseHp);
      noise.start(t);
      noise.stop(t + clickDur);
    } catch {
      // Audio no crítico
    }
  }

  private layoutFor(index: number, scroll: number): CardLayout {
    const { centerGap, stackSpacing } = this.metrics();
    const rotation = this.rotation();
    const depthZ = this.depthZ();
    const pos = index - scroll;
    const absPos = Math.abs(pos);
    const reduced = this.isReducedMotion();

    let x: number;
    if (absPos < 1) {
      x = pos * centerGap;
    } else if (pos < 0) {
      x = -centerGap - (absPos - 1) * stackSpacing;
    } else {
      x = centerGap + (absPos - 1) * stackSpacing;
    }

    let rotateY = 0;
    if (!reduced) {
      if (absPos < 0.5) {
        rotateY = -pos * (rotation * 2);
      } else if (pos < 0) {
        rotateY = rotation;
      } else {
        rotateY = -rotation;
      }
    }

    let z = 0;
    if (!reduced) {
      z = absPos > 0.5 ? depthZ : absPos * (depthZ * 2);
    }

    const zIndex = Math.round(1000 - absPos * 10);
    const brightness = 1 - Math.min(absPos, 1) * 0.5;

    return { x, z, rotateY, zIndex, brightness };
  }

  private applyAllTransforms(): void {
    const cards = this.cardEls();
    if (cards.length === 0) return;

    const { width, height } = this.metrics();
    const scroll = this.scrollPosition;

    for (const ref of cards) {
      const el = ref.nativeElement;
      const index = Number(el.dataset['index'] ?? -1);
      if (index < 0) continue;

      const layout = this.layoutFor(index, scroll);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.marginTop = `${-height / 2}px`;
      el.style.marginLeft = `${-width / 2}px`;
      el.style.zIndex = String(layout.zIndex);
      el.style.filter = `brightness(${layout.brightness})`;
      el.style.transform = `translate3d(${layout.x}px, 0, ${layout.z}px) rotateY(${layout.rotateY}deg)`;
    }
  }
}
