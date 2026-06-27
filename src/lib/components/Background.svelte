<script lang="ts">
  import { onMount } from 'svelte';
  import { themeState } from '$lib/theme.svelte';
  import { page } from '$app/state';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  // Canvas element bound from the template
  let canvas: HTMLCanvasElement | null = $state(null);

  // All canvas/window state – initialised lazily in the browser
  let hasFilter = $state(true);
  let blur = 8;
  let multiplier = $derived(hasFilter ? 5 : 2);

  const defSize = 40;
  let width = defSize;
  let height = defSize;

  // Off-screen canvas (browser-only)
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;

  // Buffer for the second canvas colours
  let secondCanvasData = new Uint8ClampedArray(0);

  let matrix: Uint8Array[] = [];
  let mainScreenPercentage = 1;
  let firstTime = true;
  let animFrameId: number | null = null;

  // ── helpers ──────────────────────────────────────────────────────────────

  function clampMultipleOf(n: number, m: number) {
    return Math.ceil(n / m) * m;
  }

  function calculateSizes() {
    const aspectRatio = window.innerWidth / document.body.scrollHeight;
    const screenAspectRatio = window.innerWidth / window.innerHeight;
    let h = clampMultipleOf(defSize / aspectRatio, 4);
    let w = defSize;
    if (screenAspectRatio < 1) {
      h = clampMultipleOf(defSize / aspectRatio / 2, 4);
      w = defSize / 2;
    }
    return { width: w, height: h };
  }

  function createMatrix(w: number, h: number): Uint8Array[] {
    const m: Uint8Array[] = [];
    for (let i = 0; i < h; i++) m.push(new Uint8Array(w));
    return m;
  }

  function generateRandomMatrix(m: Uint8Array[], bias: number, w: number, h: number) {
    for (let i = 0; i < h; i++)
      for (let j = 0; j < w; j++)
        if (!m[i][j]) m[i][j] = Math.round(Math.random() - bias);
    return m;
  }

  function hexToRgb(hex: string) {
    // strip leading # and handle 3 or 6-char forms
    const clean = hex.replace(/^#/, '');
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean;
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
    if (!result) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  function drawCanvas(
    toDraw: Uint8Array[],
    ctx: CanvasRenderingContext2D,
    color: string,
    erase: boolean,
    w: number,
    h: number,
  ) {
    const mul = hasFilter ? 5 : 2;
    const rgbObj = hexToRgb(color);
    let data = erase
      ? new Uint8ClampedArray(w * h * 4).fill(0)
      : secondCanvasData;

    let counter = 0;
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        if (data[counter + 3]) {
          counter += 4;
        } else {
          if (toDraw[i][j]) {
            data[counter++] = rgbObj.r;
            data[counter++] = rgbObj.g;
            data[counter++] = rgbObj.b;
            data[counter++] = 255;
          } else {
            counter += 3;
            data[counter++] = 0;
          }
        }
      }
    }
    if (!erase) secondCanvasData = data;

    const img = new ImageData(data, w, h);
    offCtx!.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, w * mul, h * mul);
    ctx.drawImage(offCanvas!, 0, 0, w, h, 0, 0, w * mul, h * mul);

    const gradient = ctx.createLinearGradient(0, 0, 0, h * mul);
    gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(Math.min(mainScreenPercentage / 100, 0.7), 'rgba(0,0,0,0.5)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');

    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w * mul, h * mul);
    ctx.globalCompositeOperation = 'source-over';
  }

  function calculateGeneration(m: Uint8Array[], w: number, h: number): Uint8Array[] {
    const nextGen = createMatrix(w, h);
    const maxW = w - 1;
    const maxH = h - 1;
    for (let i = 1; i < maxH; i++) {
      for (let j = 1; j < maxW; j++) {
        const neighbours =
          m[i - 1][j - 1] + m[i - 1][j] + m[i - 1][j + 1] +
          m[i][j - 1]                     + m[i][j + 1] +
          m[i + 1][j - 1] + m[i + 1][j] + m[i + 1][j + 1];
        if (!m[i][j]) {
          if (neighbours === 3) nextGen[i][j] = 1;
        } else {
          if (neighbours >= 2 && neighbours <= 3) nextGen[i][j] = 1;
        }
      }
    }
    return nextGen;
  }

  function getAccentColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  }

  function initCanvas(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Animation {
    const sizes = calculateSizes();
    width = sizes.width;
    height = sizes.height;

    secondCanvasData = new Uint8ClampedArray(width * height * 4).fill(0);

    const mul = hasFilter ? 5 : 2;
    c.width = width * mul;
    c.height = height * mul;

    matrix = createMatrix(width, height);
    matrix = generateRandomMatrix(matrix, 0.25, width, height);

    offCanvas!.width = width * mul;
    offCanvas!.height = height * mul;

    if (hasFilter) ctx.filter = `blur(${blur}px)`;

    mainScreenPercentage = ((window.innerHeight * 1.1) / document.body.scrollHeight) * 100;

    // fast-forward 20 generations
    for (let i = 0; i < 20; i++) matrix = calculateGeneration(matrix, width, height);

    const color = getAccentColor();
    drawCanvas(matrix, ctx, color, true, width, height);

    const animation = c.animate(
      [
        { opacity: firstTime ? 0 : hasFilter ? 0.5 : 0.2 },
        { opacity: hasFilter ? 1 : 0.5 },
      ],
      { duration: 1000, easing: 'cubic-bezier(.2,.7,.46,1.01)' },
    );
    firstTime = false;
    return animation;
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    hasFilter = 'filter' in CanvasRenderingContext2D.prototype;
    offCanvas = document.createElement('canvas');
    offCtx = offCanvas.getContext('2d');
  });

  // Re-run whenever the canvas element is bound, the theme changes, or the page changes.
  $effect(() => {
    // Depend on themeState.name so we re-run on theme toggle.
    const _theme = themeState.name;
    // Depend on pathname so a fresh frame is drawn on each navigation.
    const _pathname = page.url.pathname;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !offCtx) return;
    const animation = initCanvas(canvas, ctx);
    return () => {
      animation?.cancel();
    };
  });
</script>

<div class="background-wrapper">
  <div class="background-layer" aria-hidden="true">
    <canvas class="background-canvas" class:no-filter={!hasFilter} bind:this={canvas}></canvas>
  </div>
  <div class="content-layer">
    {@render children?.()}
  </div>
</div>

<style>
  .background-wrapper {
    position: relative;
    flex: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Absolute (not fixed) so the blobs span the FULL scrollable page height,
     matching specy.app — scrolling reveals new background rather than a fixed
     viewport-locked layer. */
  .background-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: 0.5;
    pointer-events: none;
    z-index: 0;
  }

  .background-canvas {
    width: 100%;
    height: 100%;
  }

  .no-filter {
    filter: blur(20px);
    opacity: 0.5;
  }

  .content-layer {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
