import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Pantalla de splash inicial.
 * Auto-navega a /welcome después de 2.5s.
 * Tap adelanta la navegación.
 * Timer siempre limpiado con DestroyRef.
 */
@Component({
  selector: 'app-splash',
  template: `
    <div
      class="flex flex-col items-center justify-center h-full w-full bg-neutral-950 text-white cursor-pointer"
      style="touch-action: manipulation;"
      (pointerup)="advance()"
      role="button"
      aria-label="Toca para comenzar"
    >

      <!-- Logo / Ícono -->
      <div
        class="w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-10"
        [class.animate-pulse]="!ready()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="1" stroke="currentColor" class="w-14 h-14 text-white/60">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </div>

      <!-- Nombre de la app -->
      <h1 class="text-4xl font-extrabold tracking-widest text-white mb-3 uppercase">
        Merz Games
      </h1>
      <p class="text-neutral-500 text-sm tracking-wider uppercase">
        Merz Aesthetics · 2026
      </p>

      <!-- Indicador de toque -->
      <div class="absolute bottom-16 flex flex-col items-center gap-2 opacity-60">
        <p class="text-neutral-400 text-sm">Toca para continuar</p>
        <div class="w-px h-8 bg-gradient-to-b from-white/40 to-transparent animate-bounce"></div>
      </div>

    </div>
  `,
})
export class Splash implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ready = signal(false);

  private timerId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.timerId = setTimeout(() => this.advance(), 2500);

    this.destroyRef.onDestroy(() => {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    });
  }

  advance(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.router.navigate(['/welcome'], { replaceUrl: true });
  }
}
